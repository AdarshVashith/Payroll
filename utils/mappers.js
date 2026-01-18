const mapEmployee = (emp) => {
    if (!emp) return null;
    return {
        _id: emp.id,
        employeeId: emp.employee_id,
        personalInfo: {
            firstName: emp.first_name,
            lastName: emp.last_name,
            email: emp.email,
            phone: emp.phone,
            dateOfBirth: emp.dob,
            gender: emp.gender,
            maritalStatus: emp.marital_status,
            address: emp.address_json
        },
        employment: {
            department: emp.department,
            designation: emp.designation,
            role: emp.role,
            employmentType: emp.employment_type,
            dateOfJoining: emp.date_of_joining,
            status: emp.status
        },
        salaryStructure: {
            ctc: emp.ctc,
            basicSalary: emp.basic_salary
        },
        bankDetails: emp.bank_details,
        createdAt: emp.created_at,
        updatedAt: emp.updated_at,
        user: emp.users ? {
            username: emp.users.username,
            email: emp.users.email,
            role: emp.users.role
        } : (emp.user_id ? { id: emp.user_id } : null)
    };
};

const mapAttendance = (record) => {
    if (!record) return null;
    return {
        _id: record.id,
        date: record.date,
        status: record.status,
        checkIn: record.check_in ? { time: record.check_in } : null,
        checkOut: record.check_out ? { time: record.check_out } : null,
        employeeId: record.employees ? mapEmployee(record.employees) : null,
        totalHours: record.working_hours?.totalHours || 0,
        overtimeHours: record.working_hours?.overtimeHours || 0,
        isLate: record.late_arrival?.isLate || false
    };
};

const mapLeave = (leave) => {
    if (!leave) return null;
    return {
        _id: leave.id,
        leaveId: leave.id.split('-')[0].toUpperCase(),
        leaveType: leave.leave_type,
        startDate: leave.start_date,
        endDate: leave.end_date,
        reason: leave.reason,
        status: leave.status,
        appliedDate: leave.applied_at,
        totalDays: leave.total_days || 0,
        employeeId: leave.employees ? mapEmployee(leave.employees) : null
    };
};

const mapExpense = (expense) => {
    if (!expense) return null;
    return {
        _id: expense.id,
        expenseType: expense.expense_type,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency || 'INR',
        expenseDate: expense.expense_date,
        submittedDate: expense.submitted_date,
        status: expense.status,
        employeeId: expense.employees ? mapEmployee(expense.employees) : null
    };
};

module.exports = {
    mapEmployee,
    mapAttendance,
    mapLeave,
    mapExpense
};
