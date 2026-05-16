# Code Comparison: Login vs Register

## The Problem

Both `login()` and `register()` in `AuthContext.tsx` should perform the **same operations**:
1. ✅ Save token to localStorage
2. ✅ Set user state
3. ✅ Set auth token
4. ✅ **CRITICAL**: Fetch profile to get augmentation data

However, `register()` was **missing step #4**.

---

## Side-by-Side Comparison

### LOGIN FUNCTION (WORKING ✅)

```typescript
const login = useCallback(async (email: string, password: string): Promise<User> => {
  setIsLoading(true);
  setError(null);
  try {
    const response = await api.login(email, password);
    
    if (response.data?.token && response.data?.user) {
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem(tokenKey, response.data.token);
      
      // Fetch augmentation after login  ✅✅✅
      try {
         const profile = await api.getProfile({ skipAuthRedirect: true });
         if (profile.data) {
           setPriceAugmentationPercent(Number((profile.data as any).price_augmentation_percent ?? 0));
           const rd = profile.data as any;
           setIsContractCustomer(
             rd.contract_validated === true && rd.customer_category === 'contract'
           );
           const pa = rd.product_augmentations;
           if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
             setProductAugmentations(
               Object.fromEntries(Object.entries(pa).map(([k, v]) => [k, Number(v)]))
             );
           }
         }
       } catch {}
      return response.data.user;
    }
    throw new Error('Invalid login response');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Login failed';
    setError(errorMessage);
    throw err;
  } finally {
    setIsLoading(false);
  }
}, [tokenKey]);
```

---

### REGISTER FUNCTION (BEFORE - BROKEN ❌)

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
    const response = await api.register({
      email,
      password,
      full_name,
      phone,
    });

    if (response.data?.token && response.data?.user) {
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem(tokenKey, response.data.token);
      return response.data.user;  // ❌ MISSING: api.getProfile() call!
    }
    throw new Error('Invalid registration response');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Registration failed';
    setError(errorMessage);
    throw err;
  } finally {
    setIsLoading(false);
  }
}, []);  // ⚠️ Also missing tokenKey dependency
};
```

---

### REGISTER FUNCTION (AFTER - FIXED ✅)

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
    const response = await api.register({
      email,
      password,
      full_name,
      phone,
    });

    if (response.data?.token && response.data?.user) {
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem(tokenKey, response.data.token);
      
      // Fetch augmentation after registration (same as login) ✅✅✅
      try {
        const profile = await api.getProfile({ skipAuthRedirect: true });
        if (profile.data) {
          setPriceAugmentationPercent(Number((profile.data as any).price_augmentation_percent ?? 0));
          const rd = profile.data as any;
          setIsContractCustomer(
            rd.contract_validated === true && rd.customer_category === 'contract'
          );
          const pa = rd.product_augmentations;
          if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
            setProductAugmentations(
              Object.fromEntries(Object.entries(pa).map(([k, v]) => [k, Number(v)]))
            );
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
}, [tokenKey]);  // ✅ Fixed dependency array too
```

---

## What Changed

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| **Profile fetch** | ❌ Missing | ✅ Added | Augmentations now populated |
| **Price augmentation** | 0 (default) | Correct value | Prices display correctly |
| **Product overrides** | {} (empty) | Correct map | Per-product pricing works |
| **Contract status** | false (default) | Correct value | Contract customers identified |
| **Dependency array** | `[]` (wrong) | `[tokenKey]` | Proper hook dependencies |

---

## Data Flow Comparison

### BEFORE (Broken)

```
Customer registers
       ↓
API creates account ✅
       ↓
setToken() ✅
setUser() ✅
       ↓
❌ STOPS HERE - doesn't fetch profile
       ↓
priceAugmentationPercent = 0 (default)
productAugmentations = {} (empty)
       ↓
Customer sees normal prices ❌
```

### AFTER (Fixed)

```
Customer registers
       ↓
API creates account ✅
       ↓
setToken() ✅
setUser() ✅
       ↓
✅ NEW: Fetch profile from /user/dashboard/profile
       ↓
Get augmentation data from backend
       ↓
priceAugmentationPercent = 15 ✅
productAugmentations = { "prod-123": 20 } ✅
       ↓
Customer sees augmented prices ✅
```

---

## Why This Matters

### Scenario: Customer Registration with Augmentation

**Admin Setup:**
```
Customer "ACME Corp" → Price Augmentation: +15%
Product "Widget" → ACME override: +20%
```

**User Registration:**
```
Email: buyer@acme.com
Name: John Smith
Password: ****
```

**Expected Behavior (NOW FIXED):**
1. Register → Account created
2. Redirected to products page
3. All products show +15% ✅
4. Widget shows +20% (override) ✅

**Old Behavior (BEFORE):**
1. Register → Account created
2. Redirected to products page
3. All products show normal price ❌
4. Widget shows normal price ❌
5. Customer confused: "Why isn't my special pricing working?"
6. Solution: Refresh page or logout/login

---

## Why It Was Missed

The `register()` function was likely implemented first, then `login()` was enhanced later with the augmentation fetch. The `register()` function was just never updated to match.

This is a common integration gap in multi-step authentication flows where:
- Initial implementation works
- Later features added to one path
- Parallel paths not kept in sync
- Tests pass because each path works individually
- But inconsistent UX appears in real usage

---

## Testing the Fix

### Before Fix
```
1. Admin: Set ACME Corp → +15% augmentation
2. New user registers (ACME email)
3. Check products page
4. Result: ❌ Normal prices (not augmented)
5. Fix: Refresh page → ✅ Now shows +15%
```

### After Fix
```
1. Admin: Set ACME Corp → +15% augmentation
2. New user registers (ACME email)
3. Check products page
4. Result: ✅ Augmented prices immediately
5. No refresh needed!
```

---

## Code Quality Notes

**Additional improvements in the fix:**
1. **Added `tokenKey` to dependency array** - Properly memoized, prevents stale closures
2. **Matches login flow exactly** - Consistent behavior, easier to maintain
3. **Proper error handling** - Silently catches profile fetch errors, doesn't break registration
4. **Type safety** - Uses `as any` casts where needed (existing pattern)

---

## Summary

| Feature | Login | Register (Before) | Register (After) |
|---------|-------|-------------------|------------------|
| Create session | ✅ | ✅ | ✅ |
| Fetch augmentations | ✅ | ❌ | ✅ |
| Set contract status | ✅ | ❌ | ✅ |
| Show correct prices | ✅ | ❌ | ✅ |
| Professional UX | ✅ | ❌ | ✅ |

**Result**: Consistent, predictable behavior across all authentication flows.
