# Pivot Plan: Customer Scan-to-Order to Owner POS/Inventory System

## 1. Analysis of Current Implementation
- **Current Role:** Customer-facing feature. Customers scan a product barcode to find nearby shops that have it in stock.
- **Key Components:**
  - `components/dashboard/customer/BarcodeScanner.tsx`: Handles the actual camera stream and barcode detection using the `BarcodeDetector` web API.
  - `components/storefront/BarcodeShopResults.tsx`: Displays the list of shops carrying the scanned barcode.
  - `app/find/[barcode]/page.tsx`: Full-page route for search results.
  - `components/dashboard/customer/HomeTab.tsx`: Where the scanner is currently triggered for customers.

## 2. What Needs to Change
The goal is to pivot this from a customer "where to buy" tool into a staff/owner "point of sale (POS)" and inventory management tool.

### A. Access & Location
- The scanner must be removed from the customer dashboard and moved to the **owner dashboard** (e.g., `components/dashboard/owner`). 
- Only authenticated shop owners/staff should be able to access the scanner to prevent unauthorized stock changes.

### B. Component Modifications (UI & Logic)
- **New Component:** We should create an `OwnerPOSScanner.tsx` (based on the existing `BarcodeScanner.tsx`).
- **Remove Shop Search:** Strip out `BarcodeShopResults` and the `/find/` routing.
- **Product Lookup:** When a barcode is scanned, the app should query the *current shop's* inventory for that specific barcode/SKU.
- **Action Interface:** If the product is found, display its Name, Price, and Current Stock. Provide buttons to:
  1. **"Checkout" (Deduct 1 from stock)**
  2. **"Update Stock" (Manually set stock number)**

### C. Database & Backend Changes
- Ensure the `products` table in Supabase has a `stock_quantity` column (or similar) and a `barcode` column.
- Create a new Server Action (e.g., in `app/actions/owner.ts`) that handles the stock decrement:
  ```typescript
  // Conceptual Server Action
  export async function decrementStock(productId: string, quantity: number = 1) {
    // 1. Verify user is owner of the shop
    // 2. Decrement stock in Supabase
    // 3. Revalidate paths to update UI
  }
  ```

## 3. Step-by-Step Implementation Plan

1. **Clean Up:** Remove the scanner entry point from `components/dashboard/customer/HomeTab.tsx`.
2. **Duplicate & Rename:** Copy `BarcodeScanner.tsx` to `components/dashboard/owner/OwnerPOSScanner.tsx`.
3. **Database Check:** Verify the `products` table structure in Supabase to ensure barcode and stock tracking fields exist.
4. **Build Server Actions:** Write the Supabase queries to (a) fetch a product by barcode for a specific shop, and (b) update its stock.
5. **Update Scanner UI:** Connect the new `OwnerPOSScanner.tsx` to the server actions. Build the "Checkout" UI overlay.
6. **Integrate:** Add the "Open POS Scanner" button to the Owner Dashboard (`components/dashboard/OwnerDashboard.tsx` or similar).

---
*This document serves as the context for pivoting the scanning feature.*
