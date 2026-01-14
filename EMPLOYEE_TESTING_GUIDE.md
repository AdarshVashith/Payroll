# Employee Management Testing Guide

## 🎯 **How to Test Employee Add/Edit/Delete Functionality**

### **Prerequisites**
1. Server is running at: http://localhost:3000
2. Database is seeded with sample data
3. You have admin credentials: admin@hrpro.com / admin123

---

## 📝 **Step-by-Step Testing Instructions**

### **1. Login as Admin**
1. Open http://localhost:3000 in your browser
2. Login with: **admin@hrpro.com** / **admin123**
3. You should see the dashboard with employee statistics

### **2. Navigate to Employee Management**
1. Click on "Employees" in the sidebar
2. You should see a list of existing employees
3. Notice the enhanced table with all employee details

### **3. Test Add New Employee**
1. Click the **"Add Employee"** button (blue button in top right)
2. A comprehensive modal form should open with multiple tabs:
   - Personal Info
   - Employment
   - Salary Structure
   - Bank Details
   - Documents

### **4. Fill Out Employee Form**

#### **Personal Info Tab (Required Fields)**
- **Employee ID**: EMP006 (or leave empty for auto-generation)
- **First Name**: Test
- **Last Name**: Employee
- **Email**: test.employee@hrpro.com
- **Phone**: +91-9876543260
- **PAN Number**: TESTX1234Y
- **Aadhaar Number**: 6789 0123 4567

#### **Employment Tab (Required Fields)**
- **Department**: Engineering
- **Designation**: Software Developer
- **Role**: Backend Developer
- **Employment Type**: Full-time
- **Date of Joining**: Select today's date
- **Employee Status**: Active

#### **Salary Structure Tab (Required Fields)**
- **Annual CTC (₹)**: 800000
- **Basic Salary (Annual)**: 400000
- **Transport Allowance**: 1600 (pre-filled)
- **Medical Allowance**: 1250 (pre-filled)

*Note: HRA and Special Allowance will auto-calculate*

#### **Bank Details Tab (Required Fields)**
- **Account Number**: 6789012345678901
- **IFSC Code**: HDFC0001234
- **Bank Name**: HDFC Bank
- **Account Holder Name**: Test Employee

### **5. Submit the Form**
1. Click **"Save Employee"** button
2. You should see a success toast notification
3. The modal should close automatically
4. The employee list should refresh and show the new employee

### **6. Test Edit Employee**
1. Find the newly created employee in the list
2. Click the **"Edit"** button (blue button with pencil icon)
3. The same modal should open with pre-filled data
4. Make some changes (e.g., change phone number)
5. Click **"Save Employee"**
6. Verify the changes are reflected in the list

### **7. Test Delete Employee**
1. Find an employee in the list
2. Click the **"Delete"** button (red button with trash icon)
3. Confirm the deletion in the popup
4. The employee should be marked as "exited" (soft delete)

---

## 🔍 **What to Look For**

### **✅ Success Indicators**
- Modal opens smoothly with all tabs
- Form validation works (required fields highlighted)
- Auto-calculation works for salary components
- Success toast appears after saving
- Employee list refreshes automatically
- Data persists after page refresh

### **❌ Error Scenarios to Test**
- Try submitting with missing required fields
- Try using duplicate Employee ID
- Try using duplicate email address
- Try invalid PAN format (should be ABCDE1234F)
- Try invalid IFSC format (should be HDFC0001234)

### **🎨 UI/UX Features**
- Responsive design (try on mobile)
- Tab navigation works smoothly
- Form fields have proper placeholders
- Loading states during submission
- Toast notifications with icons
- Proper error messages

---

## 🐛 **Troubleshooting**

### **If Employee Creation Fails**
1. Check browser console for errors (F12 → Console)
2. Check server logs in terminal
3. Verify all required fields are filled
4. Ensure you're logged in as admin/hr

### **If Modal Doesn't Open**
1. Check if JavaScript is enabled
2. Refresh the page and try again
3. Check browser console for errors

### **If Data Doesn't Save**
1. Check network tab in browser dev tools
2. Verify server is running
3. Check database connection
4. Look for validation errors in response

---

## 📊 **Expected Results**

### **After Successful Employee Creation**
- Employee appears in the list with all details
- Monthly salary is calculated and displayed in ₹
- Status badge shows correct color
- All action buttons (View, Edit, Delete) are available

### **Database Verification**
The employee should be saved with:
- Complete personal information
- Indian compliance fields (PAN, Aadhaar)
- Calculated salary components
- User account created automatically
- Proper timestamps and audit fields

---

## 🎯 **Advanced Testing**

### **Test Auto-Calculations**
1. Enter CTC: 1000000
2. Enter Basic Salary: 500000
3. Tab out of the field
4. HRA should auto-calculate to 200000 (40% of basic)
5. Special Allowance should auto-calculate based on remaining CTC

### **Test Validation**
1. Try invalid email format
2. Try PAN without proper format
3. Try IFSC without proper format
4. Try basic salary > CTC
5. All should show appropriate error messages

### **Test Filtering**
1. After creating employees, test the filter options
2. Search by name, email, or employee ID
3. Filter by department, status, employment type
4. Verify results update in real-time

---

## 🚀 **Success Criteria**

The employee management system is working correctly if:

1. ✅ **Add Employee**: Can create new employees with all required fields
2. ✅ **Edit Employee**: Can modify existing employee data
3. ✅ **Delete Employee**: Can soft-delete employees (status changes to "exited")
4. ✅ **Validation**: Proper validation for all required and formatted fields
5. ✅ **Auto-Calculation**: Salary components calculate automatically
6. ✅ **User Experience**: Smooth modal interactions, proper feedback
7. ✅ **Data Persistence**: All data saves correctly and persists
8. ✅ **Indian Compliance**: PAN, Aadhaar, IFSC validation works
9. ✅ **Currency Display**: All amounts show in Indian Rupees (₹)
10. ✅ **Responsive Design**: Works on desktop and mobile

---

**🎉 If all these tests pass, your comprehensive HR Employee Management system is working perfectly!**