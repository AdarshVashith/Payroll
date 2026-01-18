// Global variables
let currentUser = null;
let currentPage = 'dashboard';
let currentEmployees = [];
let currentPageNum = 1;
let totalPages = 1;

// Chart instances for proper cleanup
let departmentChartInstance = null;
let employeeGrowthChartInstance = null;

// API Base URL
const API_BASE = '/api';

// Utility functions
const showLoading = () => {
    document.getElementById('loading-screen').style.display = 'flex';
};

const hideLoading = () => {
    document.getElementById('loading-screen').style.display = 'none';
};

const showToast = (message, type = 'info') => {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
};

const formatDateTime = (date) => {
    return new Date(date).toLocaleString();
};

// API functions
const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        });

        if (!response.ok) {
            let errorData = null;
            try {
                errorData = await response.json();
            } catch (_) { }
            const validationMsg = Array.isArray(errorData?.errors)
                ? errorData.errors.map(e => e.msg).join(', ')
                : null;
            const message = errorData?.message || validationMsg || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(message);
        }

        return response.json();
    } catch (error) {
        // If it's a network error (Failed to fetch), provide a more helpful message
        if (error.message === 'Failed to fetch') {
            throw new Error('Network error: Unable to connect to server. Please check your internet connection or if the server is running.');
        }
        throw error;
    }
};

// Authentication functions
const login = async (email, password) => {
    try {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        localStorage.setItem('token', response.token);
        currentUser = response.user;
        return response;
    } catch (error) {
        throw error;
    }
};

const register = async (userData) => {
    try {
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        localStorage.setItem('token', response.token);
        currentUser = response.user;
        return response;
    } catch (error) {
        throw error;
    }
};

const logout = () => {
    localStorage.removeItem('token');
    currentUser = null;
    showLoginScreen();
};

const checkAuth = async () => {
    console.log('Checking authentication...');
    const token = localStorage.getItem('token');
    console.log('Token found:', !!token);

    if (!token) {
        console.log('No token, showing login screen');
        showLoginScreen();
        return false;
    }

    try {
        console.log('Making API call to /auth/me');
        const response = await apiCall('/auth/me');
        console.log('Auth response:', response);
        currentUser = response.user;
        console.log('Authentication successful');
        return true;
    } catch (error) {
        console.error('Authentication failed:', error);
        localStorage.removeItem('token');
        showLoginScreen();
        return false;
    }
};

// Screen management
const showLoginScreen = () => {
    console.log('Showing login screen');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    hideLoading();
};

const showApp = () => {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-name').textContent = currentUser.username;
    hideLoading();

    // Wait a bit to ensure DOM is ready and authentication is complete
    setTimeout(() => {
        showPage('dashboard'); // This will load the dashboard properly
    }, 100);
};

// Page navigation
const showPage = (pageId) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    document.getElementById(`${pageId}-page`).classList.add('active');

    // Update menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        employees: 'Employee Management',
        attendance: 'Attendance Management',
        leaves: 'Leave Management',
        payroll: 'Payroll Management',
        expenses: 'Expense Management',
        performance: 'Performance Management'
    };
    document.getElementById('page-title').textContent = titles[pageId];

    currentPage = pageId;

    // Load page data
    switch (pageId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'employees':
            loadEmployees();
            // Attach button event listener when employees page is shown
            const addEmployeeBtn = document.getElementById('add-employee-btn');
            if (addEmployeeBtn && !addEmployeeBtn.hasAttribute('data-listener-attached')) {
                addEmployeeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Add Employee button clicked (page-bound handler)');
                    addEmployee();
                });
                addEmployeeBtn.setAttribute('data-listener-attached', 'true');
            }
            break;
        case 'attendance':
            loadAttendance();
            // Attach attendance button event listeners
            const checkInBtn = document.getElementById('check-in-btn');
            const checkOutBtn = document.getElementById('check-out-btn');
            if (checkInBtn && !checkInBtn.hasAttribute('data-listener-attached')) {
                checkInBtn.addEventListener('click', checkIn);
                checkInBtn.setAttribute('data-listener-attached', 'true');
            }
            if (checkOutBtn && !checkOutBtn.hasAttribute('data-listener-attached')) {
                checkOutBtn.addEventListener('click', checkOut);
                checkOutBtn.setAttribute('data-listener-attached', 'true');
            }
            break;
        case 'leaves':
            loadLeaves();
            // Attach button event listener
            const applyLeaveBtn = document.getElementById('apply-leave-btn');
            if (applyLeaveBtn && !applyLeaveBtn.hasAttribute('data-listener-attached')) {
                applyLeaveBtn.addEventListener('click', applyLeave);
                applyLeaveBtn.setAttribute('data-listener-attached', 'true');
            }
            break;
        case 'payroll':
            loadPayroll();
            // Attach button event listener
            const bulkProcessBtn = document.getElementById('bulk-process-payroll-btn');
            if (bulkProcessBtn && !bulkProcessBtn.hasAttribute('data-listener-attached')) {
                bulkProcessBtn.addEventListener('click', openProcessPayrollModal);
                bulkProcessBtn.setAttribute('data-listener-attached', 'true');
            }
            break;
        case 'expenses':
            loadExpenses();
            // Attach button event listener
            const submitExpenseBtn = document.getElementById('submit-expense-btn');
            if (submitExpenseBtn && !submitExpenseBtn.hasAttribute('data-listener-attached')) {
                submitExpenseBtn.addEventListener('click', submitExpense);
                submitExpenseBtn.setAttribute('data-listener-attached', 'true');
            }
            break;
        case 'performance':
            loadPerformance();
            // Attach button event listener
            const createReviewBtn = document.getElementById('create-review-btn');
            if (createReviewBtn && !createReviewBtn.hasAttribute('data-listener-attached')) {
                createReviewBtn.addEventListener('click', createReview);
                createReviewBtn.setAttribute('data-listener-attached', 'true');
            }
            break;
    }
};

// Dashboard functions
const loadDashboard = async () => {
    // Only load dashboard if we're actually on the dashboard page
    if (currentPage !== 'dashboard') {
        return;
    }

    // Check if user is authenticated before making API calls
    if (!currentUser || !localStorage.getItem('token')) {
        console.log('User not authenticated, skipping dashboard load');
        return;
    }

    try {
        const stats = await apiCall('/dashboard/stats');

        // Update stats cards
        const totalEmployeesEl = document.getElementById('total-employees');
        const presentTodayEl = document.getElementById('present-today');
        const pendingLeavesEl = document.getElementById('pending-leaves');
        const monthlyPayrollEl = document.getElementById('monthly-payroll');

        if (totalEmployeesEl) totalEmployeesEl.textContent = stats.employees?.total || 0;
        if (presentTodayEl) presentTodayEl.textContent = stats.attendance?.present || 0;
        if (pendingLeavesEl) pendingLeavesEl.textContent = stats.leaves?.pending || 0;
        if (monthlyPayrollEl) monthlyPayrollEl.textContent = formatCurrency(stats.payroll?.monthlyTotal || 0);

        // Load recent activities
        const activities = await apiCall('/dashboard/recent-activities?limit=10');
        displayRecentActivities(activities);

        // Load department chart
        loadDepartmentChart(stats.departments);

    } catch (error) {
        console.error('Dashboard loading error:', error);

        // If it's an authentication error, redirect to login
        if (error.message.includes('authorization denied') || error.message.includes('Token is not valid')) {
            console.log('Authentication error, redirecting to login');
            localStorage.removeItem('token');
            currentUser = null;
            showLoginScreen();
            return;
        }

        showToast(`Failed to load dashboard data: ${error.message}`, 'error');
    }
};

const displayRecentActivities = (activities) => {
    const container = document.getElementById('recent-activities');

    if (!container) {
        console.warn('Recent activities container not found');
        return;
    }

    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent activities</p>';
        return;
    }

    activities.forEach(activity => {
        const activityElement = document.createElement('div');
        activityElement.className = 'activity-item';

        const iconClass = {
            employee_added: 'fa-user-plus',
            leave_request: 'fa-calendar-times',
            expense_claim: 'fa-receipt',
            payroll_processed: 'fa-money-bill-wave'
        }[activity.type] || 'fa-info-circle';

        const iconColor = {
            employee_added: '#3498db',
            leave_request: '#f39c12',
            expense_claim: '#e74c3c',
            payroll_processed: '#2ecc71'
        }[activity.type] || '#6c757d';

        activityElement.innerHTML = `
            <div class="activity-icon" style="background: ${iconColor}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="activity-info">
                <p>${activity.description}</p>
                <div class="activity-time">${formatDateTime(activity.date)}</div>
            </div>
        `;

        container.appendChild(activityElement);
    });
};

const loadDepartmentChart = (departments) => {
    const chartElement = document.getElementById('department-chart');

    if (!chartElement) {
        console.warn('Department chart element not found');
        return;
    }

    // Destroy existing chart instance if it exists
    if (departmentChartInstance) {
        departmentChartInstance.destroy();
        departmentChartInstance = null;
    }

    // Default data if no departments
    const chartData = departments && departments.length > 0
        ? departments
        : [{ _id: 'No Data', count: 1 }];

    const ctx = chartElement.getContext('2d');

    departmentChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.map(d => d._id || d.name || 'Unknown'),
            datasets: [{
                data: chartData.map(d => d.count || 0),
                backgroundColor: [
                    '#3b82f6',
                    '#22c55e',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6',
                    '#06b6d4',
                    '#64748b'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
};

// Employee functions
const loadEmployees = async (page = 1) => {
    try {
        const searchTerm = document.getElementById('employee-search')?.value || '';
        const department = document.getElementById('department-filter')?.value || '';
        const status = document.getElementById('status-filter')?.value || 'active';

        const queryParams = new URLSearchParams({
            page,
            limit: 10,
            ...(searchTerm && { search: searchTerm }),
            ...(department && { department }),
            ...(status && { status })
        });

        const response = await apiCall(`/employees?${queryParams}`);
        currentEmployees = response.employees;
        currentPageNum = response.currentPage;
        totalPages = response.totalPages;

        displayEmployees(response.employees);
        updatePagination();

        // Load departments for filter
        loadDepartments();

    } catch (error) {
        showToast('Failed to load employees', 'error');
    }
};

const displayEmployees = (employees) => {
    const tbody = document.querySelector('#employees-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No employees found</td></tr>';
        return;
    }

    employees.forEach(employee => {
        if (!employee) return;
        const firstName = employee.personalInfo?.firstName || 'Unknown';
        const lastName = employee.personalInfo?.lastName || 'Name';
        const department = employee.employment?.department || 'N/A';
        const position = employee.employment?.position || employee.employment?.designation || 'N/A';
        const status = employee.employment?.status || 'active';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${employee.employeeId || 'N/A'}</td>
            <td>${firstName} ${lastName}</td>
            <td>${department}</td>
            <td>${position}</td>
            <td><span class="status-badge status-${status}">${status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit js-edit-employee" data-id="${employee._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-sm btn-delete js-delete-employee" data-id="${employee._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Attach event listeners for CSP compliance
    const editBtns = document.querySelectorAll('.js-edit-employee');
    const deleteBtns = document.querySelectorAll('.js-delete-employee');

    console.log(`Attaching listeners to ${editBtns.length} edit buttons and ${deleteBtns.length} delete buttons`);

    editBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('Edit button clicked for ID:', btn.dataset.id);
            e.preventDefault(); // Prevent default button behavior just in case
            editEmployee(btn.dataset.id);
        });
    });

    deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('Delete button clicked for ID:', btn.dataset.id);
            e.preventDefault();
            deleteEmployee(btn.dataset.id);
        });
    });
};

const loadDepartments = async () => {
    try {
        const response = await apiCall('/employees/departments/list');
        const departments = response.departments || [];
        const select = document.getElementById('department-filter');
        if (select) {
            select.innerHTML = '<option value="">All Departments</option>';
            departments.forEach(dept => {
                const name = typeof dept === 'string' ? dept : dept.name;
                select.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load departments:', error);
        // Use default departments if API fails
        const select = document.getElementById('department-filter');
        if (select) {
            select.innerHTML = '<option value="">All Departments</option>';
            ['Engineering', 'HR', 'Finance', 'Marketing', 'Sales'].forEach(dept => {
                select.innerHTML += `<option value="${dept}">${dept}</option>`;
            });
        }
    }
};

const updatePagination = () => {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (pageInfo) pageInfo.textContent = `Page ${currentPageNum} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPageNum <= 1;
    if (nextBtn) nextBtn.disabled = currentPageNum >= totalPages;
};

// Attendance functions
const loadAttendance = async () => {
    try {
        const response = await apiCall('/attendance');
        displayAttendance(response.attendanceRecords);

        // Load today's status if user is an employee
        if (currentUser.employee) {
            loadTodayAttendance();
        }
    } catch (error) {
        showToast('Failed to load attendance data', 'error');
    }
};

const displayAttendance = (records) => {
    const tbody = document.querySelector('#attendance-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No attendance records found</td></tr>';
        return;
    }

    records.forEach(record => {
        if (!record) return;
        const employee = record.employeeId;
        const empName = employee ? `${employee.personalInfo?.firstName || 'Unknown'} ${employee.personalInfo?.lastName || ''}` : 'Deleted Employee';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${empName}</td>
            <td>${formatDate(record.date)}</td>
            <td><span class="status-badge status-${record.status}">${record.status}</span></td>
            <td>${record.checkIn?.time ? formatTime(record.checkIn.time) : '-'}</td>
            <td>${record.checkOut?.time ? formatTime(record.checkOut.time) : '-'}</td>
            <td>${record.totalHours ? record.totalHours.toFixed(2) : '0.00'}</td>
            <td>${record.overtimeHours ? record.overtimeHours.toFixed(2) : '0.00'}</td>
            <td>${record.isLate ? 'Yes' : 'No'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-info" onclick="viewAttendanceDetails('${record._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

const loadTodayAttendance = async () => {
    try {
        const response = await apiCall(`/attendance/employee/${currentUser.employee.id}/today`);
        displayTodayStatus(response);
    } catch (error) {
        console.error('Failed to load today attendance:', error);
    }
};

const displayTodayStatus = (attendance) => {
    const statusContainer = document.getElementById('today-status');
    if (!statusContainer) return;

    if (!attendance) {
        statusContainer.innerHTML = `
            <div class="status-item">
                <h5>Not Checked In</h5>
                <p>Click Check In to start your day</p>
            </div>
        `;
        return;
    }

    const checkedIn = attendance.checkIn?.time;
    const checkedOut = attendance.checkOut?.time;

    statusContainer.innerHTML = `
        <div class="status-item">
            <h5>${checkedIn ? 'Checked In' : 'Not Checked In'}</h5>
            <p>${checkedIn ? formatDateTime(checkedIn) : 'Not checked in today'}</p>
        </div>
        <div class="status-item">
            <h5>${checkedOut ? 'Checked Out' : 'Working'}</h5>
            <p>${checkedOut ? formatDateTime(checkedOut) : 'Still working'}</p>
        </div>
        <div class="status-item">
            <h5>${attendance.totalHours ? attendance.totalHours.toFixed(2) : '0.00'}</h5>
            <p>Hours Today</p>
        </div>
    `;
};

const checkIn = async () => {
    if (!currentUser.employee) {
        showToast('Only employees can check in', 'error');
        return;
    }

    try {
        await apiCall('/attendance/checkin', {
            method: 'POST',
            body: JSON.stringify({
                employeeId: currentUser.employee.id
            })
        });

        showToast('Checked in successfully', 'success');
        loadTodayAttendance();
        loadAttendance();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const checkOut = async () => {
    if (!currentUser.employee) {
        showToast('Only employees can check out', 'error');
        return;
    }

    try {
        await apiCall('/attendance/checkout', {
            method: 'POST',
            body: JSON.stringify({
                employeeId: currentUser.employee.id
            })
        });

        showToast('Checked out successfully', 'success');
        loadTodayAttendance();
        loadAttendance();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const openManualAttendanceModal = async () => {
    try {
        const response = await apiCall('/employees?limit=1000');
        const employees = response.employees;

        const employeeOptions = employees.map(emp =>
            `<option value="${emp._id}">${emp.personalInfo.firstName} ${emp.personalInfo.lastName} (${emp.employeeId})</option>`
        ).join('');

        const today = new Date().toISOString().split('T')[0];

        const content = `
            <form id="manual-attendance-form">
                <div class="form-group">
                    <label for="att-employeeId">Employee *</label>
                    <select id="att-employeeId" name="employeeId" required>
                        <option value="">Select Employee</option>
                        ${employeeOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="att-date">Date *</label>
                        <input type="date" id="att-date" name="date" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label for="att-status">Status *</label>
                        <select id="att-status" name="status" required>
                            <option value="present" selected>Present</option>
                            <option value="absent">Absent</option>
                            <option value="half-day">Half Day</option>
                            <option value="work-from-home">Work From Home</option>
                            <option value="on-leave">On Leave</option>
                            <option value="holiday">Holiday</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="att-checkIn">Check In Time</label>
                        <input type="datetime-local" id="att-checkIn" name="checkIn">
                    </div>
                    <div class="form-group">
                        <label for="att-checkOut">Check Out Time</label>
                        <input type="datetime-local" id="att-checkOut" name="checkOut">
                    </div>
                </div>
                <div class="form-group">
                    <label for="att-reason">Reason/Note</label>
                    <textarea id="att-reason" name="reason" rows="2" placeholder="Manual entry reason..."></textarea>
                </div>
            </form>
        `;

        showModal('Manual Attendance Entry', content, handleManualAttendanceSave);
    } catch (error) {
        showToast('Failed to load employee list', 'error');
    }
};

const handleManualAttendanceSave = async () => {
    const form = document.getElementById('manual-attendance-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const data = {
        employeeId: formData.get('employeeId'),
        date: formData.get('date'),
        status: formData.get('status'),
        checkIn: formData.get('checkIn') || undefined,
        checkOut: formData.get('checkOut') || undefined,
        reason: formData.get('reason')
    };

    try {
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.disabled = true;

        await apiCall('/attendance/manual-entry', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showToast('Attendance recorded successfully', 'success');
        hideModal();
        loadAttendance();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.disabled = false;
    }
};

// Leave functions
const loadLeaves = async () => {
    try {
        const response = await apiCall('/leaves');
        displayLeaves(response.leaves);
    } catch (error) {
        showToast('Failed to load leave data', 'error');
    }
};

const displayLeaves = (leaves) => {
    const tbody = document.querySelector('#leaves-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!leaves || leaves.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No leave requests found</td></tr>';
        return;
    }

    leaves.forEach(leave => {
        if (!leave) return;
        const employee = leave.employeeId;
        const empName = employee ? `${employee.personalInfo?.firstName || 'Unknown'} ${employee.personalInfo?.lastName || ''}` : 'Deleted Employee';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${leave.leaveId || 'N/A'}</td>
            <td>${empName}</td>
            <td>${leave.leaveType}</td>
            <td>${formatDate(leave.startDate)}</td>
            <td>${formatDate(leave.endDate)}</td>
            <td>${leave.totalDays}</td>
            <td><span class="status-badge status-${leave.status}">${leave.status}</span></td>
            <td>${formatDate(leave.appliedDate)}</td>
            <td>
                <div class="action-buttons">
                    ${leave.status === 'pending' || leave.status === 'submitted' ? `
                        <button class="btn-sm btn-approve" onclick="approveLeave('${leave._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-sm btn-reject" onclick="rejectLeave('${leave._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    <button class="btn-sm btn-info" onclick="viewLeaveDetails('${leave._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

// Payroll functions
const loadPayroll = async (page = 1) => {
    try {
        const employeeId = document.getElementById('payroll-employee')?.value || '';
        const department = document.getElementById('payroll-department')?.value || '';
        const status = document.getElementById('payroll-status-filter')?.value || '';
        const month = document.getElementById('payroll-month')?.value || '';
        const year = document.getElementById('payroll-year')?.value || new Date().getFullYear();

        const queryParams = new URLSearchParams({
            page,
            limit: 10,
            employeeId,
            department,
            status,
            month,
            year
        });

        const response = await apiCall(`/payroll?${queryParams.toString()}`);
        displayPayroll(response.payrolls);
        updatePayrollSummary();
    } catch (error) {
        showToast('Failed to load payroll data', 'error');
    }
};

const updatePayrollSummary = async () => {
    try {
        const month = document.getElementById('payroll-month')?.value || '';
        const year = document.getElementById('payroll-year')?.value || new Date().getFullYear();

        const response = await apiCall(`/payroll/reports/summary?month=${month}&year=${year}`);
        const summary = response.summary || {};

        document.getElementById('total-payrolls').textContent = summary.totalEmployees || 0;
        document.getElementById('processed-payrolls').textContent = summary.paidCount || 0;
        document.getElementById('pending-payrolls').textContent = summary.pendingCount || 0;
        document.getElementById('total-payroll-amount').textContent = formatCurrency(summary.totalNetPay || 0);
    } catch (error) {
        console.error('Failed to update payroll summary:', error);
    }
};

const displayPayroll = (payrolls) => {
    const tbody = document.querySelector('#payroll-table tbody');
    tbody.innerHTML = '';

    if (!payrolls || payrolls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No payroll records found</td></tr>';
        return;
    }

    payrolls.forEach(payroll => {
        if (!payroll) return;
        const row = document.createElement('tr');
        // Handle both aggregated (flat) and nested formats if necessary
        const emp = payroll.employee || payroll.employeeId;
        if (!emp) return;
        const name = emp.personalInfo ? `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}` : 'N/A';
        const dept = emp.employment ? emp.employment.department : 'N/A';

        row.innerHTML = `
            <td>${payroll.payrollId}</td>
            <td>${name}</td>
            <td>${dept}</td>
            <td>${payroll.payPeriod?.month || 'N/A'}/${payroll.payPeriod?.year || ''}</td>
            <td>${payroll.payPeriod?.actualWorkingDays || 0}/${payroll.payPeriod?.workingDays || 0}</td>
            <td>${formatCurrency(payroll.grossPay)}</td>
            <td>${formatCurrency(payroll.totalDeductions)}</td>
            <td>${formatCurrency(payroll.netPay)}</td>
            <td><span class="status-badge status-${payroll.status}">${payroll.status}</span></td>
            <td>
                <div class="action-buttons">
                    ${payroll.status === 'draft' || payroll.status === 'calculated' ? `
                        <button class="btn-sm btn-approve" title="Approve" onclick="approvePayroll('${payroll._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    ${payroll.status === 'approved' ? `
                        <button class="btn-sm btn-edit" title="Process for Payment" onclick="initiateDisbursement('${payroll._id}')">
                            <i class="fas fa-credit-card"></i>
                        </button>
                    ` : ''}
                    <button class="btn-sm btn-view" title="Download Payslip" onclick="downloadPayslip('${payroll._id}')">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn-sm btn-edit" title="Email Payslip" onclick="emailPayslip('${payroll._id}')">
                        <i class="fas fa-envelope"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

const approvePayroll = async (id) => {
    if (!confirm('Approve this payroll record?')) return;
    try {
        await apiCall(`/payroll/${id}/approve`, {
            method: 'PUT',
            body: JSON.stringify({ comments: 'Approved via web dashboard' })
        });
        showToast('Payroll approved successfully', 'success');
        loadPayroll();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const downloadPayslip = async (id) => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/payroll/${id}/payslip`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to download payslip');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const emailPayslip = async (id) => {
    try {
        await apiCall(`/payroll/${id}/email-payslip`, { method: 'POST' });
        showToast('Payslip sent via email', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const initiateDisbursement = async (id) => {
    if (!confirm('Mark this payroll as ready for disbursement?')) return;
    try {
        await apiCall('/payroll/disburse-bulk', {
            method: 'POST',
            body: JSON.stringify({
                payrollIds: [id],
                paymentMethod: 'bank-transfer'
            })
        });
        showToast('Disbursement initiated', 'success');
        loadPayroll();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const showComplianceReports = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const content = `
        <div class="compliance-form">
            <div class="form-row mb-3">
                <div class="form-group">
                    <label>Month</label>
                    <select id="comp-month" class="w-full">
                        <option value="1" ${currentMonth === 1 ? 'selected' : ''}>January</option>
                        <option value="2" ${currentMonth === 2 ? 'selected' : ''}>February</option>
                        <option value="3" ${currentMonth === 3 ? 'selected' : ''}>March</option>
                        <option value="4" ${currentMonth === 4 ? 'selected' : ''}>April</option>
                        <option value="5" ${currentMonth === 5 ? 'selected' : ''}>May</option>
                        <option value="6" ${currentMonth === 6 ? 'selected' : ''}>June</option>
                        <option value="7" ${currentMonth === 7 ? 'selected' : ''}>July</option>
                        <option value="8" ${currentMonth === 8 ? 'selected' : ''}>August</option>
                        <option value="9" ${currentMonth === 9 ? 'selected' : ''}>September</option>
                        <option value="10" ${currentMonth === 10 ? 'selected' : ''}>October</option>
                        <option value="11" ${currentMonth === 11 ? 'selected' : ''}>November</option>
                        <option value="12" ${currentMonth === 12 ? 'selected' : ''}>December</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <select id="comp-year" class="w-full">
                        <option value="2026" ${currentYear === 2026 ? 'selected' : ''}>2026</option>
                        <option value="2025" ${currentYear === 2025 ? 'selected' : ''}>2025</option>
                        <option value="2024" ${currentYear === 2024 ? 'selected' : ''}>2024</option>
                    </select>
                </div>
            </div>
            <div class="compliance-options">
                <button class="btn-secondary w-full mb-2" onclick="generateChallan('pf')">Generate PF Challan</button>
                <button class="btn-secondary w-full mb-2" onclick="generateChallan('esi')">Generate ESI Challan</button>
                <button class="btn-secondary w-full" onclick="generateChallan('pt')">Generate PT Challan</button>
            </div>
        </div>
    `;
    showModal('Compliance Reports', content);
};

window.generateChallan = async (type) => {
    const month = document.getElementById('comp-month').value;
    const year = document.getElementById('comp-year').value;
    if (!month || !year) {
        showToast('Please select month and year', 'error');
        return;
    }
    try {
        const response = await apiCall(`/payroll/compliance/challans?type=${type}&month=${month}&year=${year}`);
        const content = `<div class="challan-data"><pre class="bg-light p-3 border rounded" style="max-height: 400px; overflow: auto;">${JSON.stringify(response, null, 2)}</pre></div>`;
        showModal(`${type.toUpperCase()} Challan Data`, content);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const showTaxManagement = async () => {
    try {
        const response = await apiCall('/tax-management');
        const content = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Year</th>
                            <th>Regime</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.taxRecords.map(record => `
                            <tr>
                                <td>${record.employeeId.personalInfo.firstName}</td>
                                <td>${record.financialYear.startYear}</td>
                                <td>${record.taxRegime}</td>
                                <td>${record.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal('Tax Declarations', content);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const showSalaryDisbursement = async () => {
    try {
        const response = await apiCall('/salary-disbursement');
        const content = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Batch ID</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.disbursements.map(d => `
                            <tr>
                                <td>${d.batchId}</td>
                                <td>${formatCurrency(d.paymentDetails.netAmount)}</td>
                                <td>${d.paymentDetails.paymentMethod}</td>
                                <td>${d.transaction.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal('Recent Disbursements', content);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

// Expense functions
const loadExpenses = async () => {
    try {
        const response = await apiCall('/expenses');
        displayExpenses(response.expenses);
    } catch (error) {
        showToast('Failed to load expense data', 'error');
    }
};

const displayExpenses = (expenses) => {
    const tbody = document.querySelector('#expenses-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!expenses || expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No expense claims found</td></tr>';
        return;
    }

    expenses.forEach(expense => {
        if (!expense) return;
        const employee = expense.employeeId;
        const empName = employee ? `${employee.personalInfo?.firstName || 'Unknown'} ${employee.personalInfo?.lastName || ''}` : 'Deleted Employee';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${empName}</td>
            <td>${expense.expenseType}</td>
            <td>${formatCurrency(expense.amount)}</td>
            <td>${formatDate(expense.expenseDate)}</td>
            <td><span class="status-badge status-${expense.status}">${expense.status}</span></td>
            <td>
                <div class="action-buttons">
                    ${expense.status === 'submitted' ? `
                        <button class="btn-sm btn-approve" onclick="approveExpense('${expense._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-sm btn-reject" onclick="rejectExpense('${expense._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

// Performance functions
const loadPerformance = async () => {
    try {
        const response = await apiCall('/performance/reviews');
        displayPerformance(response.reviews);
    } catch (error) {
        showToast('Failed to load performance data', 'error');
    }
};

const displayPerformance = (reviews) => {
    const tbody = document.querySelector('#performance-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!reviews || reviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No performance reviews found</td></tr>';
        return;
    }

    reviews.forEach(review => {
        if (!review) return;
        const employee = review.employeeId;
        const empName = employee ? `${employee.personalInfo?.firstName || 'Unknown'} ${employee.personalInfo?.lastName || ''}` : 'Deleted Employee';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${empName}</td>
            <td>${review.reviewType}</td>
            <td>${formatDate(review.reviewPeriod.startDate)} - ${formatDate(review.reviewPeriod.endDate)}</td>
            <td><span class="status-badge status-${review.status}">${review.status}</span></td>
            <td>${review.overallRatings?.finalRating || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit" onclick="editReview('${review._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

// Modal functions
// Modal functions
const showModal = (title, content, onSave = null) => {
    const modalContainer = document.getElementById('modal-container');

    if (!modalContainer) {
        console.error('Modal container not found');
        showToast('Error: Modal container not found', 'error');
        return;
    }

    modalContainer.innerHTML = `
        <div class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" id="modal-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="modal-cancel-btn">Cancel</button>
                    ${onSave ? '<button class="btn-primary" id="modal-save-btn">Save</button>' : ''}
                </div>
            </div>
        </div>
    `;
    modalContainer.style.display = 'flex';

    // Attach event listeners
    document.getElementById('modal-close-btn').addEventListener('click', hideModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', hideModal);

    if (onSave) {
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', onSave);
        }
    }
};

const hideModal = () => {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.style.display = 'none';
        modalContainer.innerHTML = ''; // Clean up
    }
};

// Employee CRUD operations
// Shared variable to track edit mode
let currentEditingId = null;

const openEmployeeModal = (mode = 'create') => {
    const content = `
        <form id="add-employee-form">
            <div class="form-section">
                <h4>Basic Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="employeeId">Employee ID *</label>
                        <input type="text" id="employeeId" name="employeeId" required>
                    </div>
                    <div class="form-group">
                        <label for="emp-email">Email *</label>
                        <input type="email" id="emp-email" name="email" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input type="text" id="firstName" name="firstName" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input type="text" id="lastName" name="lastName" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="phone">Phone *</label>
                        <input type="tel" id="phone" name="phone" required>
                    </div>
                    <div class="form-group">
                        <label for="dateOfBirth">Date of Birth</label>
                        <input type="date" id="dateOfBirth" name="dateOfBirth">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="gender">Gender</label>
                        <select id="gender" name="gender">
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="maritalStatus">Marital Status</label>
                        <select id="maritalStatus" name="maritalStatus">
                            <option value="">Select Status</option>
                            <option value="single">Single</option>
                            <option value="married">Married</option>
                            <option value="divorced">Divorced</option>
                            <option value="widowed">Widowed</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4>India-specific Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="panNumber">PAN Number</label>
                        <input type="text" id="panNumber" name="panNumber" placeholder="ABCDE1234F">
                    </div>
                    <div class="form-group">
                        <label for="aadhaarNumber">Aadhaar Number</label>
                        <input type="text" id="aadhaarNumber" name="aadhaarNumber" placeholder="1234 5678 9012">
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4>Employment Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="department">Department *</label>
                        <select id="department" name="department" required>
                            <option value="">Select Department</option>
                            <option value="Engineering">Engineering</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Sales">Sales</option>
                            <option value="Human Resources">Human Resources</option>
                            <option value="Finance">Finance</option>
                            <option value="Operations">Operations</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="designation">Designation *</label>
                        <input type="text" id="designation" name="designation" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="role">Role *</label>
                        <input type="text" id="role" name="role" required>
                    </div>
                    <div class="form-group">
                        <label for="dateOfJoining">Date of Joining *</label>
                        <input type="date" id="dateOfJoining" name="dateOfJoining" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="employmentType">Employment Type *</label>
                        <select id="employmentType" name="employmentType" required>
                            <option value="full-time">Full-time</option>
                            <option value="part-time">Part-time</option>
                            <option value="contract">Contract</option>
                            <option value="intern">Intern</option>
                            <option value="consultant">Consultant</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="employmentStatus">Employee Status *</label>
                        <select id="employmentStatus" name="employmentStatus" required>
                            <option value="active" selected>Active</option>
                            <option value="on-notice">On Notice</option>
                            <option value="inactive">Inactive</option>
                            <option value="exited">Exited</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4>Salary Structure</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="ctc">CTC (Annual) *</label>
                        <input type="number" id="ctc" name="ctc" required>
                    </div>
                    <div class="form-group">
                        <label for="basicSalary">Basic Salary (Monthly) *</label>
                        <input type="number" id="basicSalary" name="basicSalary" required>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h4>Bank Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="accountNumber">Account Number *</label>
                        <input type="text" id="accountNumber" name="accountNumber" required>
                    </div>
                    <div class="form-group">
                        <label for="ifscCode">IFSC Code *</label>
                        <input type="text" id="ifscCode" name="ifscCode" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="bankName">Bank Name *</label>
                        <input type="text" id="bankName" name="bankName" required>
                    </div>
                    <div class="form-group">
                        <label for="accountHolderName">Account Holder Name *</label>
                        <input type="text" id="accountHolderName" name="accountHolderName" required>
                    </div>
                </div>
            </div>
        </form>
    `;

    const title = mode === 'edit' ? 'Edit Employee' : 'Add New Employee';
    showModal(title, content, handleEmployeeSave);

    // Update button text if needed (showModal defaults to Save)
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.textContent = mode === 'edit' ? 'Update' : 'Save';
    }
};

const addEmployee = () => {
    // Check if user has permission to add employees
    if (!currentUser || !['admin', 'hr'].includes(currentUser.role)) {
        showToast('You do not have permission to add employees', 'error');
        return;
    }
    currentEditingId = null; // Reset editing ID for new employee
    openEmployeeModal('create');
};

const editEmployee = async (id) => {
    try {
        currentEditingId = id;
        const employee = await apiCall(`/employees/${id}`);

        openEmployeeModal('edit'); // Open modal with edit title and save button text

        // Populate form fields after the modal content is rendered by openEmployeeModal
        document.getElementById('employeeId').value = employee.employeeId || '';
        document.getElementById('emp-email').value = employee.personalInfo.email || '';
        document.getElementById('firstName').value = employee.personalInfo.firstName || '';
        document.getElementById('lastName').value = employee.personalInfo.lastName || '';
        document.getElementById('phone').value = employee.personalInfo.phone || '';
        document.getElementById('dateOfBirth').value = employee.personalInfo.dateOfBirth ? new Date(employee.personalInfo.dateOfBirth).toISOString().split('T')[0] : '';
        document.getElementById('gender').value = employee.personalInfo.gender || '';
        document.getElementById('maritalStatus').value = employee.personalInfo.maritalStatus || '';
        document.getElementById('panNumber').value = employee.personalInfo.panNumber || '';
        document.getElementById('aadhaarNumber').value = employee.personalInfo.aadhaarNumber || '';

        // Handle department: check if exists in options, if not add it
        const departmentSelect = document.getElementById('department');
        const empDept = employee.employment.department;
        if (empDept) {
            let optionExists = false;
            for (let i = 0; i < departmentSelect.options.length; i++) {
                if (departmentSelect.options[i].value === empDept) {
                    optionExists = true;
                    break;
                }
            }
            if (!optionExists) {
                const newOption = document.createElement('option');
                newOption.value = empDept;
                newOption.textContent = empDept;
                departmentSelect.appendChild(newOption);
            }
            departmentSelect.value = empDept;
        }

        document.getElementById('designation').value = employee.employment.designation || '';
        document.getElementById('role').value = employee.employment.role || '';
        document.getElementById('dateOfJoining').value = employee.employment.dateOfJoining ? new Date(employee.employment.dateOfJoining).toISOString().split('T')[0] : '';
        document.getElementById('employmentType').value = employee.employment.employmentType || 'full-time';
        document.getElementById('employmentStatus').value = employee.employment.status || 'active';

        document.getElementById('ctc').value = employee.salaryStructure?.ctc || '';
        document.getElementById('basicSalary').value = employee.salaryStructure?.basicSalary || '';

        document.getElementById('accountNumber').value = employee.bankDetails?.accountNumber || '';
        document.getElementById('ifscCode').value = employee.bankDetails?.ifscCode || '';
        document.getElementById('bankName').value = employee.bankDetails?.bankName || '';
        document.getElementById('accountHolderName').value = employee.bankDetails?.accountHolderName || '';

    } catch (error) {
        console.error('Error fetching employee:', error);
        showToast('Failed to load employee details', 'error');
    }
};

const deleteEmployee = async (id) => {
    if (!confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
        return;
    }

    try {
        await apiCall(`/employees/${id}`, { method: 'DELETE' });
        showToast('Employee deleted successfully', 'success');

        // Immediate UI update
        const row = document.querySelector(`button[data-id="${id}"]`).closest('tr');
        if (row) row.remove();

        loadEmployees(); // Reload properly in background
    } catch (error) {
        showToast(error.message || 'Failed to delete employee', 'error');
    }
};

const handleEmployeeSave = async () => {
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
        const form = document.getElementById('add-employee-form');

        // Form validation
        if (!form.checkValidity()) {
            form.reportValidity();
            if (saveBtn) saveBtn.disabled = false;
            return;
        }

        const formData = new FormData(form);

        const employeeData = {
            employeeId: formData.get('employeeId'),
            personalInfo: {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                dateOfBirth: formData.get('dateOfBirth') || undefined,
                gender: formData.get('gender') || undefined,
                maritalStatus: formData.get('maritalStatus') || undefined,
                panNumber: formData.get('panNumber') || undefined,
                aadhaarNumber: formData.get('aadhaarNumber') || undefined
            },
            employment: {
                department: document.getElementById('department').value ||
                    (currentEditingId ? currentEmployees.find(e => e._id === currentEditingId)?.employment?.department : ''),
                designation: formData.get('designation'),
                role: formData.get('role'),
                employmentType: formData.get('employmentType') || 'full-time',
                status: formData.get('employmentStatus') || 'active',
                dateOfJoining: formData.get('dateOfJoining')
            },
            salaryStructure: {
                ctc: parseFloat(formData.get('ctc')),
                basicSalary: parseFloat(formData.get('basicSalary')),
                transportAllowance: parseFloat(formData.get('transportAllowance')) || 1600,
                medicalAllowance: parseFloat(formData.get('medicalAllowance')) || 1250,
                currency: 'INR',
                payFrequency: 'monthly'
            },
            bankDetails: {
                accountNumber: formData.get('accountNumber'),
                ifscCode: formData.get('ifscCode'),
                bankName: formData.get('bankName'),
                accountHolderName: formData.get('accountHolderName')
            }
        };

        const method = currentEditingId ? 'PUT' : 'POST';
        const url = currentEditingId ? `/employees/${currentEditingId}` : '/employees';

        console.log('Spending employee data:', JSON.stringify(employeeData, null, 2));

        await apiCall(url, {
            method: method,
            body: JSON.stringify(employeeData)
        });

        showToast(currentEditingId ? 'Employee updated successfully' : 'Employee added successfully', 'success');
        hideModal();
        loadEmployees();
    } catch (error) {
        console.error('Save error:', error);
        showToast(error.message || 'Failed to save employee', 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
};



const approveLeave = async (id) => {
    try {
        await apiCall(`/leaves/${id}/approve`, { method: 'PUT' });
        showToast('Leave approved successfully', 'success');
        loadLeaves();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const rejectLeave = async (id) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
        await apiCall(`/leaves/${id}/reject`, {
            method: 'PUT',
            body: JSON.stringify({ rejectionReason: reason })
        });
        showToast('Leave rejected', 'success');
        loadLeaves();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const processPayroll = async (id) => {
    try {
        await apiCall(`/payroll/${id}/process`, { method: 'POST' });
        showToast('Payroll processed successfully', 'success');
        loadPayroll();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const payPayroll = async (id) => {
    try {
        await apiCall(`/payroll/${id}/pay`, { method: 'POST' });
        showToast('Payroll marked as paid', 'success');
        loadPayroll();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const approveExpense = async (id) => {
    try {
        await apiCall(`/expenses/${id}/approve`, { method: 'PUT' });
        showToast('Expense approved successfully', 'success');
        loadExpenses();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const rejectExpense = async (id) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
        await apiCall(`/expenses/${id}/reject`, {
            method: 'PUT',
            body: JSON.stringify({ comments: reason })
        });
        showToast('Expense rejected', 'success');
        loadExpenses();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

// Leave Management CRUD operations
const applyLeave = () => {
    const content = `
        <form id="leave-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="leaveType">Leave Type *</label>
                    <select id="leaveType" name="leaveType" required>
                        <option value="">Select Leave Type</option>
                        <option value="vacation">Vacation</option>
                        <option value="sick">Sick Leave</option>
                        <option value="personal">Personal Leave</option>
                        <option value="maternity">Maternity Leave</option>
                        <option value="paternity">Paternity Leave</option>
                        <option value="bereavement">Bereavement Leave</option>
                        <option value="emergency">Emergency Leave</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="isHalfDay">Half Day?</label>
                    <input type="checkbox" id="isHalfDay" name="isHalfDay" onchange="toggleHalfDay()">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="startDate">Start Date *</label>
                    <input type="date" id="startDate" name="startDate" required>
                </div>
                <div class="form-group" id="endDateGroup">
                    <label for="endDate">End Date *</label>
                    <input type="date" id="endDate" name="endDate" required>
                </div>
            </div>
            
            <div id="halfDayPeriod" style="display: none;">
                <div class="form-group">
                    <label for="halfDayPeriodSelect">Half Day Period</label>
                    <select id="halfDayPeriodSelect" name="halfDayPeriod">
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label for="reason">Reason *</label>
                <textarea id="reason" name="reason" rows="3" required placeholder="Please provide reason for leave..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="emergencyContactName">Emergency Contact Name</label>
                <input type="text" id="emergencyContactName" name="emergencyContactName">
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="emergencyContactPhone">Emergency Contact Phone</label>
                    <input type="tel" id="emergencyContactPhone" name="emergencyContactPhone">
                </div>
                <div class="form-group">
                    <label for="emergencyContactRelation">Relationship</label>
                    <input type="text" id="emergencyContactRelation" name="emergencyContactRelation">
                </div>
            </div>
        </form>
        
        <script>
            function toggleHalfDay() {
                const isHalfDay = document.getElementById('isHalfDay').checked;
                const endDateGroup = document.getElementById('endDateGroup');
                const halfDayPeriod = document.getElementById('halfDayPeriod');
                const endDateInput = document.getElementById('endDate');
                
                if (isHalfDay) {
                    endDateGroup.style.display = 'none';
                    halfDayPeriod.style.display = 'block';
                    endDateInput.required = false;
                } else {
                    endDateGroup.style.display = 'block';
                    halfDayPeriod.style.display = 'none';
                    endDateInput.required = true;
                }
            }
        </script>
    `;

    showModal('Apply for Leave', content, async () => {
        const form = document.getElementById('leave-form');
        const formData = new FormData(form);

        if (!currentUser.employee) {
            showToast('Only employees can apply for leave', 'error');
            return;
        }

        const isHalfDay = formData.get('isHalfDay') === 'on';
        const startDate = formData.get('startDate');
        const endDate = isHalfDay ? startDate : formData.get('endDate');

        const leaveData = {
            employeeId: currentUser.employee.id,
            leaveType: formData.get('leaveType'),
            startDate: startDate,
            endDate: endDate,
            reason: formData.get('reason'),
            isHalfDay: isHalfDay,
            halfDayPeriod: isHalfDay ? formData.get('halfDayPeriod') : undefined,
            emergencyContact: {
                name: formData.get('emergencyContactName') || undefined,
                phone: formData.get('emergencyContactPhone') || undefined,
                relationship: formData.get('emergencyContactRelation') || undefined
            }
        };

        try {
            await apiCall('/leaves', {
                method: 'POST',
                body: JSON.stringify(leaveData)
            });

            showToast('Leave application submitted successfully', 'success');
            hideModal();
            loadLeaves();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
};

// Event listeners
// Simple initialization without complex auth flow
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - simple initialization');

    // Check for existing session
    const init = async () => {
        const isAuthenticated = await checkAuth();
        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');

        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        if (isAuthenticated) {
            showApp();
        } else {
            if (loginScreen) {
                loginScreen.style.display = 'flex';
                console.log('Login screen visible');
            }
        }
    };

    // Initialize after a short delay to ensure DOM is ready
    setTimeout(init, 1000);

    // Clear any existing tokens - REMOVE FOR PRODUCTION/PERSISTENCE
    // localStorage.clear();
    // console.log('Cleared localStorage');


    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await login(formData.get('email'), formData.get('password'));
            showToast('Login successful', 'success');
            showApp();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await register({
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role')
            });
            showToast('Registration successful', 'success');
            showApp();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // Toggle between login and register
    document.getElementById('register-link').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    document.getElementById('login-link').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    });

    // Sidebar navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            showPage(page);
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Sidebar toggle for mobile
    document.querySelector('.sidebar-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });

    // Button event listeners
    // Employee search and filters
    document.getElementById('employee-search')?.addEventListener('input', () => {
        loadEmployees(1);
    });

    document.getElementById('department-filter')?.addEventListener('change', () => {
        loadEmployees(1);
    });

    document.getElementById('status-filter')?.addEventListener('change', () => {
        loadEmployees(1);
    });

    // Manual Attendance
    document.getElementById('manual-attendance-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openManualAttendanceModal();
    });

    document.getElementById('payroll-employee')?.addEventListener('change', () => loadPayroll());
    document.getElementById('payroll-department')?.addEventListener('change', () => loadPayroll());
    document.getElementById('payroll-status-filter')?.addEventListener('change', () => loadPayroll());
    document.getElementById('payroll-month')?.addEventListener('change', () => loadPayroll());
    document.getElementById('payroll-year')?.addEventListener('change', () => loadPayroll());

    document.getElementById('compliance-reports-btn')?.addEventListener('click', showComplianceReports);
    document.getElementById('tax-management-btn')?.addEventListener('click', showTaxManagement);
    document.getElementById('salary-disbursement-btn')?.addEventListener('click', showSalaryDisbursement);
    document.getElementById('bulk-process-payroll-btn')?.addEventListener('click', openProcessPayrollModal);

    // Ensure Add Employee button works even if handler didn't attach on page switch
    const addEmployeeBtnGlobal = document.getElementById('add-employee-btn');
    if (addEmployeeBtnGlobal && !addEmployeeBtnGlobal.hasAttribute('data-listener-attached')) {
        addEmployeeBtnGlobal.addEventListener('click', (e) => {
            e.preventDefault();
            addEmployee();
        });
        addEmployeeBtnGlobal.setAttribute('data-listener-attached', 'true');
    }
});

// Expense Management CRUD operations
const submitExpense = () => {
    const content = `
        <form id="expense-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="expenseType">Expense Type *</label>
                    <select id="expenseType" name="expenseType" required>
                        <option value="">Select Expense Type</option>
                        <option value="travel">Travel</option>
                        <option value="meals">Meals & Entertainment</option>
                        <option value="accommodation">Accommodation</option>
                        <option value="transportation">Transportation</option>
                        <option value="office-supplies">Office Supplies</option>
                        <option value="training">Training & Development</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="amount">Amount *</label>
                    <input type="number" id="amount" name="amount" step="0.01" min="0" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="expenseDate">Expense Date *</label>
                    <input type="date" id="expenseDate" name="expenseDate" required>
                </div>
                <div class="form-group">
                    <label for="category">Category *</label>
                    <input type="text" id="category" name="category" required placeholder="e.g., Business Travel, Client Meeting">
                </div>
            </div>
            
            <div class="form-group">
                <label for="description">Description *</label>
                <textarea id="description" name="description" rows="3" required placeholder="Detailed description of the expense..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="businessPurpose">Business Purpose *</label>
                <textarea id="businessPurpose" name="businessPurpose" rows="2" required placeholder="Business justification for this expense..."></textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="project">Project (Optional)</label>
                    <input type="text" id="project" name="project" placeholder="Project name or code">
                </div>
                <div class="form-group">
                    <label for="reimbursementMethod">Reimbursement Method</label>
                    <select id="reimbursementMethod" name="reimbursementMethod">
                        <option value="direct-deposit">Direct Deposit</option>
                        <option value="check">Check</option>
                        <option value="petty-cash">Petty Cash</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label for="notes">Additional Notes</label>
                <textarea id="notes" name="notes" rows="2" placeholder="Any additional information..."></textarea>
            </div>
        </form>
    `;

    showModal('Submit Expense Claim', content, async () => {
        const form = document.getElementById('expense-form');
        const formData = new FormData(form);

        if (!currentUser.employee) {
            showToast('Only employees can submit expense claims', 'error');
            return;
        }

        const expenseData = {
            employeeId: currentUser.employee.id,
            expenseType: formData.get('expenseType'),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            expenseDate: formData.get('expenseDate'),
            category: formData.get('category'),
            businessPurpose: formData.get('businessPurpose'),
            project: formData.get('project') || undefined,
            reimbursementMethod: formData.get('reimbursementMethod'),
            notes: formData.get('notes') || undefined
        };

        try {
            await apiCall('/expenses', {
                method: 'POST',
                body: JSON.stringify(expenseData)
            });

            showToast('Expense claim submitted successfully', 'success');
            hideModal();
            loadExpenses();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
};

// Payroll Management CRUD operations
const openProcessPayrollModal = async () => {
    try {
        const response = await apiCall('/employees?limit=1000&status=active');
        const employees = response.employees;

        const employeeOptions = employees.map(emp =>
            `<option value="${emp._id}">${emp.personalInfo.firstName} ${emp.personalInfo.lastName} (${emp.employeeId})</option>`
        ).join('');

        const content = `
            <form id="payroll-process-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="proc-month">Month *</label>
                        <select id="proc-month" name="month" required>
                            <option value="1">January</option>
                            <option value="2">February</option>
                            <option value="3">March</option>
                            <option value="4">April</option>
                            <option value="5">May</option>
                            <option value="6">June</option>
                            <option value="7">July</option>
                            <option value="8">August</option>
                            <option value="9">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="proc-year">Year *</label>
                        <select id="proc-year" name="year" required>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="proc-employeeId">Employee (Optional - leave empty for all)</label>
                    <select id="proc-employeeId" name="employeeId">
                        <option value="">All Employees</option>
                        ${employeeOptions}
                    </select>
                </div>
            </form>
        `;

        showModal('Process Payroll', content, handlePayrollProcess);

        // Default to current month/year
        const now = new Date();
        document.getElementById('proc-month').value = now.getMonth() + 1;
        document.getElementById('proc-year').value = now.getFullYear();
    } catch (error) {
        showToast('Failed to load employee list', 'error');
    }
};

const handlePayrollProcess = async () => {
    const form = document.getElementById('payroll-process-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const data = {
        month: parseInt(formData.get('month')),
        year: parseInt(formData.get('year')),
        employeeIds: formData.get('employeeId') ? [formData.get('employeeId')] : []
    };

    try {
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.disabled = true;

        const response = await apiCall('/payroll/process-bulk', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showToast(response.message || 'Payroll processing started', 'success');
        hideModal();
        loadPayroll();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.disabled = false;
    }
};

// Performance Management CRUD operations
const createReview = () => {
    const content = `
        <form id="review-form">
            <div class="form-group">
                <label for="employeeSelect">Select Employee *</label>
                <select id="employeeSelect" name="employeeId" required>
                    <option value="">Select Employee</option>
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="reviewType">Review Type *</label>
                    <select id="reviewType" name="reviewType" required>
                        <option value="">Select Review Type</option>
                        <option value="annual">Annual Review</option>
                        <option value="quarterly">Quarterly Review</option>
                        <option value="probation">Probation Review</option>
                        <option value="project">Project Review</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="status">Status</label>
                    <select id="status" name="status">
                        <option value="draft">Draft</option>
                        <option value="self-review">Self Review</option>
                        <option value="manager-review">Manager Review</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="startDate">Review Period Start *</label>
                    <input type="date" id="startDate" name="startDate" required>
                </div>
                <div class="form-group">
                    <label for="endDate">Review Period End *</label>
                    <input type="date" id="endDate" name="endDate" required>
                </div>
            </div>
            
            <h4>Goals</h4>
            <div id="goals-container">
                <div class="goal-item">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Goal Title</label>
                            <input type="text" name="goalTitle[]" placeholder="Goal title">
                        </div>
                        <div class="form-group">
                            <label>KRA</label>
                            <input type="text" name="goalKra[]" placeholder="Key Result Area">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="goalDescription[]" rows="2" placeholder="Goal description"></textarea>
                    </div>
                </div>
            </div>
            <button type="button" onclick="addGoal()" class="btn-secondary">Add Another Goal</button>
            
            <h4>Competencies</h4>
            <div id="competencies-container">
                <div class="competency-item">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Competency Name</label>
                            <input type="text" name="competencyName[]" placeholder="e.g., Communication, Leadership">
                        </div>
                        <div class="form-group">
                            <label>Self Rating (1-5)</label>
                            <input type="number" name="competencySelfRating[]" min="1" max="5">
                        </div>
                    </div>
                </div>
            </div>
            <button type="button" onclick="addCompetency()" class="btn-secondary">Add Another Competency</button>
            
            <div class="form-group">
                <label for="managerComments">Manager Comments</label>
                <textarea id="managerComments" name="managerComments" rows="3" placeholder="Manager's feedback and comments..."></textarea>
            </div>
        </form>
        
        <script>
            function addGoal() {
                const container = document.getElementById('goals-container');
                const goalItem = document.createElement('div');
                goalItem.className = 'goal-item';
                goalItem.innerHTML = \`
                    <div class="form-row">
                        <div class="form-group">
                            <label>Goal Title</label>
                            <input type="text" name="goalTitle[]" placeholder="Goal title">
                        </div>
                        <div class="form-group">
                            <label>KRA</label>
                            <input type="text" name="goalKra[]" placeholder="Key Result Area">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="goalDescription[]" rows="2" placeholder="Goal description"></textarea>
                    </div>
                    <button type="button" onclick="this.parentElement.remove()" class="btn-sm btn-delete">Remove</button>
                \`;
                container.appendChild(goalItem);
            }
            
            function addCompetency() {
                const container = document.getElementById('competencies-container');
                const competencyItem = document.createElement('div');
                competencyItem.className = 'competency-item';
                competencyItem.innerHTML = \`
                    <div class="form-row">
                        <div class="form-group">
                            <label>Competency Name</label>
                            <input type="text" name="competencyName[]" placeholder="e.g., Communication, Leadership">
                        </div>
                        <div class="form-group">
                            <label>Self Rating (1-5)</label>
                            <input type="number" name="competencySelfRating[]" min="1" max="5">
                        </div>
                    </div>
                    <button type="button" onclick="this.parentElement.remove()" class="btn-sm btn-delete">Remove</button>
                \`;
                container.appendChild(competencyItem);
            }
        </script>
    `;

    showModal('Create Performance Review', content, async () => {
        // Load employees for selection
        try {
            const response = await apiCall('/employees?limit=100');
            const employeeSelect = document.getElementById('employeeSelect');
            response.employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp._id;
                option.textContent = `${emp.employeeId} - ${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`;
                employeeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load employees:', error);
        }
    }, async () => {
        const form = document.getElementById('review-form');
        const formData = new FormData(form);

        // Process goals
        const goalTitles = formData.getAll('goalTitle[]');
        const goalKras = formData.getAll('goalKra[]');
        const goalDescriptions = formData.getAll('goalDescription[]');

        const goals = goalTitles.map((title, index) => ({
            title: title,
            kra: goalKras[index] || '',
            description: goalDescriptions[index] || '',
            status: 'not-started',
            progress: 0
        })).filter(goal => goal.title.trim() !== '');

        // Process competencies
        const competencyNames = formData.getAll('competencyName[]');
        const competencySelfRatings = formData.getAll('competencySelfRating[]');

        const competencies = competencyNames.map((name, index) => ({
            name: name,
            selfRating: parseInt(competencySelfRatings[index]) || 1
        })).filter(comp => comp.name.trim() !== '');

        const reviewData = {
            employeeId: formData.get('employeeId'),
            reviewType: formData.get('reviewType'),
            reviewPeriod: {
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate')
            },
            status: formData.get('status'),
            goals: goals,
            competencies: competencies,
            managerComments: formData.get('managerComments') || undefined
        };

        try {
            await apiCall('/performance/reviews', {
                method: 'POST',
                body: JSON.stringify(reviewData)
            });

            showToast('Performance review created successfully', 'success');
            hideModal();
            loadPerformance();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
};

const editReview = async (id) => {
    try {
        const review = await apiCall(`/performance/reviews/${id}`);
        showToast('Edit review functionality - viewing review details', 'info');
        console.log('Review details:', review);
    } catch (error) {
        showToast('Failed to load review details', 'error');
    }
};

// Utility functions for better UX
const formatEmployeeName = (employee) => {
    return `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
};

const getStatusColor = (status) => {
    const colors = {
        'active': '#28a745',
        'inactive': '#6c757d',
        'terminated': '#dc3545',
        'pending': '#ffc107',
        'approved': '#17a2b8',
        'rejected': '#dc3545',
        'submitted': '#ffc107',
        'processed': '#17a2b8',
        'paid': '#28a745',
        'draft': '#6c757d',
        'self-review': '#6c757d',
        'manager-review': '#ffc107',
        'completed': '#28a745'
    };
    return colors[status] || '#6c757d';
};

// Enhanced table display functions
const createActionButton = (text, className, onclick, icon = null) => {
    return `<button class="btn-sm ${className}" onclick="${onclick}">
        ${icon ? `<i class="fas ${icon}"></i>` : ''}
        ${text}
    </button>`;
};

// Auto-refresh functionality
let autoRefreshInterval = null;

const startAutoRefresh = () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = setInterval(() => {
        // Only refresh dashboard if user is on dashboard page and no modal is open
        const modalContainer = document.getElementById('modal-container');
        const isModalOpen = modalContainer && modalContainer.style.display === 'flex';

        if (currentPage === 'dashboard' && !isModalOpen) {
            loadDashboard();
        }
    }, 30000); // Refresh every 30 seconds
};

const stopAutoRefresh = () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
};

// Enhanced error handling
const handleApiError = (error, context = '') => {
    console.error(`API Error ${context}:`, error);

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
            logout();
        }, 2000);
    } else if (error.message.includes('403')) {
        showToast('Access denied. Insufficient permissions.', 'error');
    } else if (error.message.includes('404')) {
        showToast('Resource not found.', 'error');
    } else if (error.message.includes('500')) {
        showToast('Server error. Please try again later.', 'error');
    } else {
        showToast(error.message || 'An unexpected error occurred.', 'error');
    }
};

// Form validation helpers
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

const validatePhone = (phone) => {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/[\s\-\(\)]/g, ''));
};

const validateRequired = (value, fieldName) => {
    if (!value || value.trim() === '') {
        throw new Error(`${fieldName} is required`);
    }
    return true;
};

// Export/Import functionality (placeholder for future implementation)
const exportData = (type) => {
    showToast(`Export ${type} functionality coming soon`, 'info');
};

const importData = (type) => {
    showToast(`Import ${type} functionality coming soon`, 'info');
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for quick search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) {
            searchInput.focus();
        }
    }

    // Escape to close modal
    if (e.key === 'Escape') {
        hideModal();
    }

    // Ctrl/Cmd + N for new item (context dependent)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        switch (currentPage) {
            case 'employees':
                addEmployee();
                break;
            case 'leaves':
                applyLeave();
                break;
            case 'expenses':
                submitExpense();
                break;
            case 'payroll':
                openProcessPayrollModal();
                break;
            case 'performance':
                createReview();
                break;
        }
    }
});

// Global delegated click handlers as a fallback to ensure buttons work even if page listeners miss
document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('#add-employee-btn');
    if (addBtn) {
        e.preventDefault();
        console.log('Add Employee button clicked (global delegated handler)');
        addEmployee();
    }
});

// Initialize auto-refresh when app starts
document.addEventListener('DOMContentLoaded', () => {
    startAutoRefresh();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
// Enhanced user feedback and loading states
const showLoadingState = (element) => {
    if (element) {
        element.classList.add('loading');
        element.disabled = true;
    }
};

const hideLoadingState = (element) => {
    if (element) {
        element.classList.remove('loading');
        element.disabled = false;
    }
};

// Confirmation dialogs for destructive actions
const confirmAction = (message, onConfirm) => {
    const content = `
        <div class="confirmation-dialog">
            <div class="confirmation-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p>${message}</p>
            <div class="confirmation-buttons">
                <button class="btn-secondary" onclick="hideModal()">Cancel</button>
                <button class="btn-primary btn-danger" onclick="confirmAndClose()">Confirm</button>
            </div>
        </div>
    `;

    showModal('Confirm Action', content);

    window.confirmAndClose = () => {
        hideModal();
        onConfirm();
    };
};

// Enhanced delete employee with confirmation
const deleteEmployeeConfirm = (id) => {
    confirmAction(
        'Are you sure you want to terminate this employee? This action cannot be undone.',
        () => deleteEmployee(id)
    );
};

// Data validation before form submission
const validateEmployeeForm = (formData) => {
    try {
        validateRequired(formData.get('employeeId'), 'Employee ID');
        validateRequired(formData.get('firstName'), 'First Name');
        validateRequired(formData.get('lastName'), 'Last Name');
        validateRequired(formData.get('department'), 'Department');
        validateRequired(formData.get('designation'), 'Designation');
        validateRequired(formData.get('dateOfJoining'), 'Date of Joining');
        validateRequired(formData.get('basicSalary'), 'Basic Salary');

        const email = formData.get('email');
        if (email && !validateEmail(email)) {
            throw new Error('Please enter a valid email address');
        }

        const phone = formData.get('phone');
        if (phone && !validatePhone(phone)) {
            throw new Error('Please enter a valid phone number');
        }

        const salary = parseFloat(formData.get('basicSalary'));
        if (salary <= 0 || Number.isNaN(salary)) {
            throw new Error('Basic salary must be greater than 0');
        }

        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
};

// Success messages for different actions
const getSuccessMessage = (action, type) => {
    const messages = {
        create: {
            employee: 'Employee added successfully! Welcome to the team!',
            leave: 'Leave application submitted successfully! You will be notified of the decision.',
            expense: 'Expense claim submitted successfully! It will be reviewed shortly.',
            payroll: 'Payroll processed successfully! Employee will be notified.',
            review: 'Performance review created successfully! Employee can now begin self-evaluation.'
        },
        update: {
            employee: 'Employee information updated successfully!',
            leave: 'Leave request updated successfully!',
            expense: 'Expense claim updated successfully!',
            payroll: 'Payroll information updated successfully!',
            review: 'Performance review updated successfully!'
        },
        delete: {
            employee: 'Employee has been terminated successfully.',
            leave: 'Leave request cancelled successfully.',
            expense: 'Expense claim cancelled successfully.',
            payroll: 'Payroll record deleted successfully.',
            review: 'Performance review deleted successfully.'
        },
        approve: {
            leave: 'Leave request approved! Employee has been notified.',
            expense: 'Expense claim approved! Processing for payment.',
            payroll: 'Payroll approved and ready for payment.',
            review: 'Performance review approved and completed.'
        },
        reject: {
            leave: 'Leave request rejected. Employee has been notified.',
            expense: 'Expense claim rejected. Employee has been notified.',
            payroll: 'Payroll rejected. Please review and resubmit.',
            review: 'Performance review rejected. Please revise.'
        }
    };

    return messages[action]?.[type] || `${action} completed successfully!`;
};

// Initialize tooltips and help text
const initializeHelpSystem = () => {
    // Add help tooltips to form fields
    const helpTexts = {
        'employeeId': 'Unique identifier for the employee (e.g., EMP001)',
        'basicSalary': 'Monthly basic salary amount',
        'dateOfJoining': 'Employee\'s first day of work',
        'department': 'The department this employee belongs to',
        'designation': 'Job title or role within the department',
        'leaveType': 'Select the appropriate leave category',
        'expenseType': 'Category that best describes this expense',
        'businessPurpose': 'Explain how this expense benefits the business'
    };

    Object.entries(helpTexts).forEach(([fieldId, helpText]) => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.title = helpText;
            field.setAttribute('data-help', helpText);
        }
    });
};

// Call help system initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeHelpSystem, 1000);
});