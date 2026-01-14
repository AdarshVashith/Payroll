// Global variables
let currentUser = null;
let currentPage = 'dashboard';
let currentEmployees = [];
let currentPageNum = 1;
let totalPages = 1;

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
            } catch (_) {}
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
            throw new Error('Network error: Unable to connect to server. Please check if the server is running on http://localhost:3000');
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
            const processPayrollBtn = document.getElementById('process-payroll-btn');
            if (processPayrollBtn && !processPayrollBtn.hasAttribute('data-listener-attached')) {
                processPayrollBtn.addEventListener('click', openProcessPayrollModal);
                processPayrollBtn.setAttribute('data-listener-attached', 'true');
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
        
        if (totalEmployeesEl) totalEmployeesEl.textContent = stats.employees.total;
        if (presentTodayEl) presentTodayEl.textContent = stats.attendance.present;
        if (pendingLeavesEl) pendingLeavesEl.textContent = stats.leaves.pending;
        if (monthlyPayrollEl) monthlyPayrollEl.textContent = formatCurrency(stats.payroll.monthlyTotal);
        
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
    
    const ctx = chartElement.getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: departments.map(d => d._id),
            datasets: [{
                data: departments.map(d => d.count),
                backgroundColor: [
                    '#3498db',
                    '#2ecc71',
                    '#f39c12',
                    '#e74c3c',
                    '#9b59b6',
                    '#1abc9c',
                    '#34495e'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
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
        const status = document.getElementById('status-filter')?.value || '';
        
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
    tbody.innerHTML = '';
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No employees found</td></tr>';
        return;
    }
    
    employees.forEach(employee => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${employee.employeeId}</td>
            <td>${employee.personalInfo.firstName} ${employee.personalInfo.lastName}</td>
            <td>${employee.employment.department}</td>
            <td>${employee.employment.position}</td>
            <td><span class="status-badge status-${employee.employment.status}">${employee.employment.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit" onclick="editEmployee('${employee._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-sm btn-delete" onclick="deleteEmployee('${employee._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

const loadDepartments = async () => {
    try {
        const departments = await apiCall('/employees/departments/list');
        const select = document.getElementById('department-filter');
        if (select) {
            select.innerHTML = '<option value="">All Departments</option>';
            departments.forEach(dept => {
                select.innerHTML += `<option value="${dept}">${dept}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load departments:', error);
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
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No attendance records found</td></tr>';
        return;
    }
    
    records.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(record.date)}</td>
            <td>${record.employeeId.personalInfo.firstName} ${record.employeeId.personalInfo.lastName}</td>
            <td>${record.checkIn.time ? formatDateTime(record.checkIn.time) : '-'}</td>
            <td>${record.checkOut.time ? formatDateTime(record.checkOut.time) : '-'}</td>
            <td>${record.totalHours ? record.totalHours.toFixed(2) : '0.00'} hrs</td>
            <td><span class="status-badge status-${record.status}">${record.status}</span></td>
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
    
    const checkedIn = attendance.checkIn.time;
    const checkedOut = attendance.checkOut.time;
    
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
    tbody.innerHTML = '';
    
    if (leaves.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No leave requests found</td></tr>';
        return;
    }
    
    leaves.forEach(leave => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${leave.employeeId.personalInfo.firstName} ${leave.employeeId.personalInfo.lastName}</td>
            <td>${leave.leaveType}</td>
            <td>${formatDate(leave.startDate)}</td>
            <td>${formatDate(leave.endDate)}</td>
            <td>${leave.totalDays}</td>
            <td><span class="status-badge status-${leave.status}">${leave.status}</span></td>
            <td>
                <div class="action-buttons">
                    ${leave.status === 'pending' ? `
                        <button class="btn-sm btn-approve" onclick="approveLeave('${leave._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-sm btn-reject" onclick="rejectLeave('${leave._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
};

// Payroll functions
const loadPayroll = async () => {
    try {
        const response = await apiCall('/payroll');
        displayPayroll(response.payrolls);
    } catch (error) {
        showToast('Failed to load payroll data', 'error');
    }
};

const displayPayroll = (payrolls) => {
    const tbody = document.querySelector('#payroll-table tbody');
    tbody.innerHTML = '';
    
    if (payrolls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No payroll records found</td></tr>';
        return;
    }
    
    payrolls.forEach(payroll => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payroll.employeeId.personalInfo.firstName} ${payroll.employeeId.personalInfo.lastName}</td>
            <td>${formatDate(payroll.payPeriod.startDate)} - ${formatDate(payroll.payPeriod.endDate)}</td>
            <td>${formatCurrency(payroll.earnings.totalEarnings)}</td>
            <td>${formatCurrency(payroll.deductions.totalDeductions)}</td>
            <td>${formatCurrency(payroll.netPay)}</td>
            <td><span class="status-badge status-${payroll.status}">${payroll.status}</span></td>
            <td>
                <div class="action-buttons">
                    ${payroll.status === 'draft' ? `
                        <button class="btn-sm btn-approve" onclick="processPayroll('${payroll._id}')">
                            Process
                        </button>
                    ` : ''}
                    ${payroll.status === 'processed' ? `
                        <button class="btn-sm btn-approve" onclick="payPayroll('${payroll._id}')">
                            Pay
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
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
    tbody.innerHTML = '';
    
    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No expense claims found</td></tr>';
        return;
    }
    
    expenses.forEach(expense => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${expense.employeeId.personalInfo.firstName} ${expense.employeeId.personalInfo.lastName}</td>
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
    tbody.innerHTML = '';
    
    if (reviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No performance reviews found</td></tr>';
        return;
    }
    
    reviews.forEach(review => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${review.employeeId.personalInfo.firstName} ${review.employeeId.personalInfo.lastName}</td>
            <td>${review.reviewType}</td>
            <td>${formatDate(review.reviewPeriod.startDate)} - ${formatDate(review.reviewPeriod.endDate)}</td>
            <td><span class="status-badge status-${review.status}">${review.status}</span></td>
            <td>${review.overallRatings.finalRating || '-'}</td>
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
                    <button class="modal-close" onclick="hideModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="hideModal()">Cancel</button>
                    ${onSave ? '<button class="btn-primary" onclick="handleModalSave()">Save</button>' : ''}
                </div>
            </div>
        </div>
    `;
    modalContainer.style.display = 'flex';
    
    // Store the save callback
    if (onSave) {
        window.currentModalSave = onSave;
    }
};

const hideModal = () => {
    document.getElementById('modal-container').style.display = 'none';
    window.currentModalSave = null;
};

const handleModalSave = () => {
    if (window.currentModalSave) {
        window.currentModalSave();
    }
};

// Employee CRUD operations
const addEmployee = () => {
    console.log('addEmployee invoked');
    // Check if user has permission to add employees
    if (!currentUser || !['admin', 'hr'].includes(currentUser.role)) {
        showToast('You do not have permission to add employees', 'error');
        return;
    }
    
    const content = `
        <form id="employee-form">
            <div class="form-section">
                <h4>Basic Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="employeeId">Employee ID *</label>
                        <input type="text" id="employeeId" name="employeeId" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email *</label>
                        <input type="email" id="email" name="email" required>
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
    
    showModal('Add New Employee', content, async () => {
        const form = document.getElementById('employee-form');
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
                department: formData.get('department'),
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
        
        try {
            const response = await apiCall('/employees', {
                method: 'POST',
                body: JSON.stringify(employeeData)
            });
            
            showToast('Employee added successfully', 'success');
            hideModal();
            loadEmployees();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
};

const editEmployee = async (id) => {
    try {
        const employee = await apiCall(`/employees/${id}`);
        
        const content = `
            <form id="employee-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="employeeId">Employee ID *</label>
                        <input type="text" id="employeeId" name="employeeId" value="${employee.employeeId}" required readonly>
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" value="${employee.userId?.email || ''}" readonly>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input type="text" id="firstName" name="firstName" value="${employee.personalInfo.firstName}" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input type="text" id="lastName" name="lastName" value="${employee.personalInfo.lastName}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="department">Department *</label>
                        <select id="department" name="department" required>
                            <option value="">Select Department</option>
                            <option value="Engineering" ${employee.employment.department === 'Engineering' ? 'selected' : ''}>Engineering</option>
                            <option value="Marketing" ${employee.employment.department === 'Marketing' ? 'selected' : ''}>Marketing</option>
                            <option value="Sales" ${employee.employment.department === 'Sales' ? 'selected' : ''}>Sales</option>
                            <option value="Human Resources" ${employee.employment.department === 'Human Resources' ? 'selected' : ''}>Human Resources</option>
                            <option value="Finance" ${employee.employment.department === 'Finance' ? 'selected' : ''}>Finance</option>
                            <option value="Operations" ${employee.employment.department === 'Operations' ? 'selected' : ''}>Operations</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="designation">Designation *</label>
                        <input type="text" id="designation" name="designation" value="${employee.employment.designation || ''}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="dateOfJoining">Date of Joining *</label>
                        <input type="date" id="dateOfJoining" name="dateOfJoining" value="${employee.employment.dateOfJoining ? new Date(employee.employment.dateOfJoining).toISOString().split('T')[0] : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="basicSalary">Basic Salary *</label>
                        <input type="number" id="basicSalary" name="basicSalary" value="${employee.salaryStructure?.basicSalary || ''}" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="role">Role *</label>
                        <input type="text" id="role" name="role" value="${employee.employment.role || ''}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="phone">Phone</label>
                        <input type="tel" id="phone" name="phone" value="${employee.personalInfo.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label for="dateOfBirth">Date of Birth</label>
                        <input type="date" id="dateOfBirth" name="dateOfBirth" value="${employee.personalInfo.dateOfBirth ? new Date(employee.personalInfo.dateOfBirth).toISOString().split('T')[0] : ''}">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="gender">Gender</label>
                        <select id="gender" name="gender">
                            <option value="">Select Gender</option>
                            <option value="male" ${employee.personalInfo.gender === 'male' ? 'selected' : ''}>Male</option>
                            <option value="female" ${employee.personalInfo.gender === 'female' ? 'selected' : ''}>Female</option>
                            <option value="other" ${employee.personalInfo.gender === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="status">Status</label>
                        <select id="status" name="status">
                            <option value="active" ${employee.employment.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="on-notice" ${employee.employment.status === 'on-notice' ? 'selected' : ''}>On Notice</option>
                            <option value="inactive" ${employee.employment.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="exited" ${employee.employment.status === 'exited' ? 'selected' : ''}>Exited</option>
                        </select>
                    </div>
                </div>
            </form>
        `;
        
        showModal('Edit Employee', content, async () => {
            const form = document.getElementById('employee-form');
            const formData = new FormData(form);
            
            const updateData = {
                personalInfo: {
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    dateOfBirth: formData.get('dateOfBirth') || undefined,
                    gender: formData.get('gender') || undefined,
                    phone: formData.get('phone') || undefined
                },
                employment: {
                    department: formData.get('department'),
                    designation: formData.get('designation'),
                    role: formData.get('role'),
                    dateOfJoining: formData.get('dateOfJoining'),
                    status: formData.get('status')
                },
                salaryStructure: {
                    basicSalary: parseFloat(formData.get('basicSalary'))
                }
            };
            
            try {
                await apiCall(`/employees/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });
                
                showToast('Employee updated successfully', 'success');
                hideModal();
                loadEmployees();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    } catch (error) {
        showToast('Failed to load employee data', 'error');
    }
};

const deleteEmployee = async (id) => {
    if (confirm('Are you sure you want to terminate this employee?')) {
        try {
            await apiCall(`/employees/${id}`, {
                method: 'DELETE'
            });
            
            showToast('Employee terminated successfully', 'success');
            loadEmployees();
        } catch (error) {
            showToast(error.message, 'error');
        }
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
    
    // Force hide loading screen after 2 seconds
    setTimeout(() => {
        console.log('Hiding loading screen');
        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            console.log('Login screen should be visible now');
        } else {
            console.error('Login screen element not found');
        }
    }, 2000);
    
    // Clear any existing tokens
    localStorage.clear();
    console.log('Cleared localStorage');

    
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
    
    // Pagination
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPageNum > 1) {
            loadEmployees(currentPageNum - 1);
        }
    });
    
    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPageNum < totalPages) {
            loadEmployees(currentPageNum + 1);
        }
    });

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
const openProcessPayrollModal = () => {
    const content = `
        <form id="payroll-form">
            <div class="form-group">
                <label for="employeeSelect">Select Employee *</label>
                <select id="employeeSelect" name="employeeId" required>
                    <option value="">Select Employee</option>
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="startDate">Pay Period Start *</label>
                    <input type="date" id="startDate" name="startDate" required>
                </div>
                <div class="form-group">
                    <label for="endDate">Pay Period End *</label>
                    <input type="date" id="endDate" name="endDate" required>
                </div>
            </div>
            
            <h4>Earnings</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="baseSalary">Base Salary *</label>
                    <input type="number" id="baseSalary" name="baseSalary" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="overtime">Overtime</label>
                    <input type="number" id="overtime" name="overtime" step="0.01" value="0">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="bonus">Bonus</label>
                    <input type="number" id="bonus" name="bonus" step="0.01" value="0">
                </div>
                <div class="form-group">
                    <label for="allowances">Allowances</label>
                    <input type="number" id="allowances" name="allowances" step="0.01" value="0">
                </div>
            </div>
            
            <h4>Additional Information</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="regularHours">Regular Hours</label>
                    <input type="number" id="regularHours" name="regularHours" step="0.1" value="160">
                </div>
                <div class="form-group">
                    <label for="overtimeHours">Overtime Hours</label>
                    <input type="number" id="overtimeHours" name="overtimeHours" step="0.1" value="0">
                </div>
            </div>
            
            <div class="form-group">
                <label for="notes">Notes</label>
                <textarea id="notes" name="notes" rows="2" placeholder="Any additional notes..."></textarea>
            </div>
        </form>
    `;
    
    showModal('Process Payroll', content, async () => {
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
        const form = document.getElementById('payroll-form');
        const formData = new FormData(form);
        
        const payrollData = {
            employeeId: formData.get('employeeId'),
            payPeriod: {
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate')
            },
            earnings: {
                baseSalary: parseFloat(formData.get('baseSalary')),
                overtime: parseFloat(formData.get('overtime')) || 0,
                bonus: parseFloat(formData.get('bonus')) || 0,
                allowances: parseFloat(formData.get('allowances')) || 0
            },
            hoursWorked: {
                regularHours: parseFloat(formData.get('regularHours')) || 0,
                overtimeHours: parseFloat(formData.get('overtimeHours')) || 0
            },
            notes: formData.get('notes') || undefined
        };
        
        try {
            await apiCall('/payroll', {
                method: 'POST',
                body: JSON.stringify(payrollData)
            });
            
            showToast('Payroll processed successfully', 'success');
            hideModal();
            loadPayroll();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
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