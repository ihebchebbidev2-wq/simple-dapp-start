# Admin Quick Reference: Customer Price Augmentation

## What Is It?

**Price Augmentation** = Customer-specific price markup or discount applied to products.

### Two Types:

#### 1️⃣ General Augmentation (All Products)
- Applies to **every product** a customer views
- Set once per customer
- Example: "ACME Corp gets 15% markup on everything"

#### 2️⃣ Per-Product Augmentation (Override)
- Applies to **specific products** for a customer
- Overrides the general augmentation
- Example: "ACME Corp gets 15% on everything, but 25% on Widgets"

---

## How To Set It Up

### Step 1: Set General Augmentation

```
Admin Menu → Customers → Select Customer → Edit

Find field: "Price Augmentation %"
Enter: 15.00  (for 15% markup)
       -5.00 (for 5% discount)
       0     (no change)

Save
```

### Step 2: Set Per-Product Overrides (Optional)

```
Admin Menu → Products → Select Product → Scroll to "Per-Customer Prices"

Click: "Add Customer Price"
Select: Customer name from dropdown
Enter: Augmentation (%) = 20.00
Click: Save

Result: That customer gets 20% on this product 
        (instead of their general 15%)
```

---

## Price Formula

```
Final Price = Base Price × (1 + Augmentation %)

Examples:
- Base $100, +15% augmentation → $115
- Base $100, -5% augmentation  → $95  
- Base $100, +0% augmentation  → $100 (no change)
- Base $100, -100% augmentation → $0 (free!)
```

---

## When Does It Take Effect?

| Action | Immediate? | When Visible? |
|--------|-----------|---------------|
| Set general augmentation | ✅ Yes | Customer refreshes page |
| Set per-product override | ✅ Yes | Customer refreshes page |
| **Customer registers** | ✅ Yes | **Immediately after registration** |
| Customer logs in | ✅ Yes | Immediately after login |
| Customer already logged in | ❌ No | After page refresh or re-login |

### Note:
If a customer is **already browsing** when you change their augmentation, they won't see the change until they:
- Refresh the page, OR
- Log out and log back in

This is by design to prevent prices changing mid-session.

---

## Common Scenarios

### Scenario 1: Bulk Discount for Reseller
```
Customer: "Best Resellers Inc"
Action: Set General Augmentation to -20%

Result: All products cost 20% less for them
(Great for wholesale accounts)
```

### Scenario 2: Loss Leader Product
```
Customer: "ACME Corp" (general: +15%)
Action: Set Widget product to -100%

Result: 
- All products: +15% markup
- Widget: Free! (costs nothing)
(Selling one product cheap to build loyalty)
```

### Scenario 3: Tiered Pricing
```
Set Per-Product Augmentations:

Customer: "ACME Corp"
- Product A: +10%
- Product B: +20%
- Product C: -5%

Result: Different margins on different products
```

### Scenario 4: Negative Augmentation (Discount)
```
Customer: "Loyal Customer"
Action: Set General Augmentation to -10%

Result: Everything costs 10% less
(Customer retention strategy)
```

---

## Troubleshooting

### Problem: "Customer doesn't see the price change"

**Solution**: 
1. Verify you saved the changes ✅
2. Ask customer to:
   - Refresh the page (Ctrl+F5 or Cmd+Shift+R)
   - Or log out completely and log back in
3. Check the value was entered correctly (no typos)

### Problem: "All products showing old price"

**Solution**:
1. Go to: Admin → Customers → Select customer
2. Check: "Price Augmentation %" field
3. If empty or 0: No augmentation is set
4. If has value: Click "Edit" and click "Save" to refresh
5. Customer must refresh their page to see changes

### Problem: "Only some products have wrong price"

**Solution**:
1. You probably set a per-product override
2. Go to: Admin → Products → Select product
3. Scroll to: "Per-Customer Prices" section
4. Check if that customer is listed there
5. The per-product value overrides the general augmentation

### Problem: "New customers register but see wrong prices"

**Solution** (FIXED):
- This was a bug in the registration flow
- It's now fixed! New customers should see correct prices immediately
- If still seeing old prices: Ask them to refresh the page

---

## Quick Validation Checklist

Before setting prices, verify:

- [ ] You selected the correct customer
- [ ] You entered the correct percentage
- [ ] Positive = markup, Negative = discount
- [ ] You clicked "Save" (page shows success message)
- [ ] You didn't accidentally set a per-product override conflicting with general
- [ ] Customer understands when changes take effect (after page refresh)

---

## Example Complete Workflow

**Goal**: Give "TechCorp" a 12% markup on all products, except give 5% markup on "Widget" (instead of 12%).

### Steps:

1. **Set General Augmentation**
   ```
   Admin → Customers → Search "TechCorp" → Edit
   Price Augmentation % = 12.00
   Save ✅
   ```

2. **Set Per-Product Override**
   ```
   Admin → Products → Search "Widget" → Edit
   Scroll: "Per-Customer Prices" section
   Add Customer Price:
     - Select: TechCorp
     - Enter: 5.00
     - Save ✅
   ```

3. **Verify**
   ```
   As TechCorp customer:
   - Login or Register
   - Visit Products page
   - Check: All prices +12% ✅
   - Find Widget: Price +5% (override) ✅
   ```

---

## FAQ

**Q: Can augmentation be more than 100%?**
A: Yes! You can set up to 500% markup. (Though in practice 0-50% is typical)

**Q: Can it be negative?**
A: Yes! Negative = discount. You can go to -100% (free).

**Q: Does it affect orders they already placed?**
A: No. Augmentation only affects NEW browsing/orders after it's set.

**Q: Do they see a note about their special pricing?**
A: Not in the current version. They just see the price already applied.

**Q: What if I set BOTH general and per-product augmentation?**
A: Per-product wins (overrides the general one).

**Q: If I clear the general augmentation, does per-product still apply?**
A: Yes, per-product overrides would still apply to those specific products.

**Q: Can multiple customers share the same augmentation?**
A: Yes, set each customer individually. (Future: could add bulk operations)

**Q: When customers see their price, do they know why it's different?**
A: Not automatically. They just see the price. You may want to explain in:
- Invoices
- Email communications  
- Customer portal help text

---

## Technical Details (For Reference)

### Where It's Stored
- **Database**: `remquip_customers.price_augmentation_percent`
- **Per-product**: `remquip_customer_product_prices` table

### How It Works
1. Customer logs in → Backend fetches augmentation data
2. Frontend stores it in React Context (`AuthContext`)
3. Product pages apply it when calculating prices
4. Cart and orders also see the augmented price

### Audit Trail
- Changes are logged in database (created_at, updated_at fields)
- Admin can review history if needed

---

## Support & Questions

If customers ask "Why is my price different?":

**Response template:**
```
Hello [Customer],

Thank you for your interest. Your special pricing is based on your 
account agreement with us. 

All prices on our site reflect:
1. Our regular pricing
2. Any active discounts
3. Your account-specific pricing agreement

If you have questions about your pricing, please contact your 
account manager.

Best regards,
[Your Company]
```

---

## Future Improvements (Coming Soon?)

- 🚀 Bulk price augmentation for multiple customers
- 🚀 Price augmentation rules (e.g., "15% on products over $100")
- 🚀 Customer sees note explaining why price is different
- 🚀 Historical price changes audit log
- 🚀 Temporary augmentation (valid from/to dates)
- 🚀 Category-based augmentation (not just per-product)
