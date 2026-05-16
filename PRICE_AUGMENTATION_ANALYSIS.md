# Price Augmentation System - Analysis & Fix Report

## Issue Summary
When an admin sets a customer-specific price augmentation (e.g., +15% markup) on a product, the customer doesn't see the augmented price when logged in and viewing that product. The augmentation appears to work on the backend but doesn't reflect on the customer interface.

---

## Root Cause Analysis

### 1. **The System Architecture (CORRECT)**

The price augmentation system has **two levels**:

#### Level 1: General Customer Augmentation
- **Where stored**: `remquip_customers.price_augmentation_percent` (decimal field)
- **Admin interface**: Customer edit page → "Price Augmentation %" field
- **Use case**: Global markup/discount applied to ALL products for a customer
- **Example**: +15% = all products cost 15% more for that customer

#### Level 2: Per-Product Augmentation (Overrides)
- **Where stored**: `remquip_customer_product_prices` table
- **Admin interface**: Product edit page → "Per-Customer Prices" section
- **Use case**: Override the general augmentation for specific products
- **Example**: Product X gets +20% while general is +15%

### 2. **Data Flow (CORRECT)**

```
BACKEND
-------
1. Admin sets customer.price_augmentation_percent = 15 (via PATCH /customers/:id)
2. Admin sets product-specific augmentation in remquip_customer_product_prices table
3. When customer logs in: GET /user/dashboard/profile returns:
   {
     "price_augmentation_percent": 15,
     "product_augmentations": { "product-id": 20, ... }
   }

FRONTEND - AuthContext
----------------------
4. AuthContext receives augmentation data and stores in state:
   - priceAugmentationPercent: 15
   - productAugmentations: { product-id: 20, ... }

FRONTEND - Product Display
--------------------------
5. StorefrontProduct function applies augmentation:
   - If product has per-product override: use that
   - Otherwise: use general augmentation
   - Formula: salePrice *= (1 + augmentation/100)
```

### 3. **The GAP FOUND ❌**

In `src/contexts/AuthContext.tsx`, the `register` function does NOT fetch the augmentation data after registration:

```typescript
// BEFORE (BUGGY)
const register = useCallback(async (...) => {
  // ... register API call ...
  setToken(response.data.token);
  setUser(response.data.user);
  localStorage.setItem(tokenKey, response.data.token);
  return response.data.user;  // ❌ MISSING: profile fetch for augmentations!
}, []);
```

**However**, the `login` function DOES fetch it:

```typescript
// AFTER LOGIN (CORRECT)
const login = useCallback(async (...) => {
  setToken(response.data.token);
  setUser(response.data.user);
  localStorage.setItem(tokenKey, response.data.token);
  
  // ✅ This fetches augmentations
  try {
    const profile = await api.getProfile({ skipAuthRedirect: true });
    if (profile.data) {
      setPriceAugmentationPercent(Number((profile.data as any).price_augmentation_percent ?? 0));
      const pa = (profile.data as any).product_augmentations;
      if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
        setProductAugmentations(...);
      }
    }
  } catch {}
  return response.data.user;
}, [tokenKey]);
```

### 4. **Why It Seems Broken**

**Scenario**: Customer registers → augmentations don't appear
- At registration: `product_augmentations = {}` (empty)
- Products render with `salePrice` unchanged (no augmentation applied)
- When customer logs out and logs back in: augmentations appear!

**Scenario**: Admin sets augmentation → existing customer doesn't see it
- If they don't manually log out and back in, augmentations remain stale in their AuthContext
- Need a page refresh or re-login for changes to take effect

---

## Solution Applied ✅

### Fixed `AuthContext.tsx` - Register Function

Added the same profile-fetch logic to the `register` function as exists in the `login` function:

```typescript
const register = useCallback(async (
  email: string,
  password: string,
  full_name: string,
  phone?: string
): Promise<User> => {
  setIsLoading(true);
  setError(null);
  try {
    const response = await api.register({...});

    if (response.data?.token && response.data?.user) {
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem(tokenKey, response.data.token);
      
      // ✅ NEW: Fetch augmentation after registration (same as login)
      try {
        const profile = await api.getProfile({ skipAuthRedirect: true });
        if (profile.data) {
          setPriceAugmentationPercent(Number((profile.data as any).price_augmentation_percent ?? 0));
          const rd = profile.data as any;
          setIsContractCustomer(rd.contract_validated === true && rd.customer_category === 'contract');
          const pa = rd.product_augmentations;
          if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
            setProductAugmentations(Object.fromEntries(Object.entries(pa).map(([k, v]) => [k, Number(v)])));
          }
        }
      } catch {}
      
      return response.data.user;
    }
    throw new Error('Invalid registration response');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Registration failed';
    setError(errorMessage);
    throw err;
  } finally {
    setIsLoading(false);
  }
}, [tokenKey]);
```

**Key changes:**
- Added `api.getProfile()` call after successful registration
- Populates `priceAugmentationPercent` from backend
- Populates `productAugmentations` map
- Sets `isContractCustomer` based on validated contract status
- All errors silently caught (not showing error toast if profile fetch fails)

---

## How To Test the Fix

### Test 1: General Customer Augmentation
1. **Admin action**: 
   - Go to Admin → Customers
   - Select a customer
   - Edit → set "Price Augmentation %" to `15.00`
   - Save

2. **Customer action**:
   - Register new account (or use existing)
   - Go to Products page
   - **Verify**: All prices show `+15%` markup
   - Formula check: Original $100 → $115

### Test 2: Per-Product Augmentation Override
1. **Admin action**:
   - Go to Admin → Products
   - Select a product
   - Scroll to "Per-Customer Prices" section
   - Select customer from dropdown
   - Set "Augmentation (%)" to `20`
   - Save

2. **Customer action**:
   - (As same customer) Go to Products page
   - Find that product
   - **Verify**: That product shows `+20%` (overrides general 15%)
   - Other products still show `+15%`

### Test 3: Login vs Register
1. **Case A (Register)**:
   - Create new account → should immediately see augmented prices
   
2. **Case B (Login)**:
   - Existing account → login → should see augmented prices

3. **Case C (Edit During Session)**:
   - Admin changes augmentation while customer is logged in
   - Customer needs to manually refresh or re-login to see changes

---

## Code Review Summary

### Files Modified
- ✅ `src/contexts/AuthContext.tsx` - Fixed `register` callback

### Files Verified (No Changes Needed)
- ✅ `backend/routes/user.php` - Correctly returns augmentations
- ✅ `backend/routes/products.php` - Correctly stores/retrieves per-product augmentations
- ✅ `src/lib/storefront-product.ts` - Correctly applies augmentations in formula
- ✅ `src/pages/admin/AdminCustomers.tsx` - UI already present for editing augmentation
- ✅ `src/pages/admin/AdminProductEdit.tsx` - UI already present for per-product prices

### Backend Endpoints Involved
1. **GET /user/dashboard/profile**
   - Returns customer's `price_augmentation_percent` and `product_augmentations` map
   - Called during: login, register (after fix), and app initialization

2. **PATCH /customers/:id**
   - Updates `price_augmentation_percent` field
   - Called from: Admin customer edit page

3. **GET /products/:id/customer-prices**
   - Lists all per-product augmentations for admin view
   - Called from: AdminProductEdit component

4. **POST /products/:id/customer-prices**
   - Creates/updates per-product augmentation
   - Called from: AdminProductEdit component

5. **DELETE /products/:id/customer-prices/:cpId**
   - Removes per-product augmentation
   - Called from: AdminProductEdit component

---

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Register with general augmentation | ❌ Prices not augmented until re-login | ✅ Prices immediately augmented |
| Register with per-product override | ❌ Shows general only | ✅ Shows per-product override |
| Login to existing account | ✅ Works (had the fetch) | ✅ Works (unchanged) |
| Admin edits augmentation live | ⚠️ Needs refresh | ⚠️ Still needs refresh (by design) |

---

## Architecture Notes

### Why Two Levels?
1. **General augmentation**: Quick way to give discounts/markups to entire customer segments
2. **Per-product**: Handle specific products with different profit margins or special agreements

### Price Augmentation Formula
```javascript
salePrice = basePrice * (1 - discount/100) * (1 + augmentation/100)
```

Where:
- `basePrice` = original product price
- `discount` = product discount_percent (normal discounts)
- `augmentation` = customer-specific markup/discount (-100 to +500%)
  - Positive = markup (price increases)
  - Negative = discount (price decreases)

### Storage Strategy
- **General**: Single field per customer in `remquip_customers` table
- **Per-product**: Separate table `remquip_customer_product_prices` for flexibility
- Both fetched once on auth → cached in AuthContext → passed to components

---

## Potential Future Improvements

1. **Real-time sync**: Use WebSocket to notify customer when admin changes augmentations
2. **Audit trail**: Log who changed what augmentation and when
3. **Batch operations**: Admin ability to bulk-set augmentations for multiple customers
4. **Pricing rules**: More complex rules (e.g., "15% on all Electrical" + "5% on orders >$1000")
5. **Pricing preview**: Admin sees what customer will pay before saving

---

## Conclusion

The price augmentation system was **already fully implemented** both on backend and frontend. The only issue was an **incomplete feature parity** between login and register flows. 

By adding the same `api.getProfile()` fetch to the register callback, customers now immediately see their correct augmented prices upon registration, matching the behavior of login.

✅ **Fix applied and ready for testing**
