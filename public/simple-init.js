// HR Pro Application - Simplified and Working Version
console.log('HR Pro application starting...');

// Global state
let currentUser = null;
let currentPage = 'dashboard';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    initializeApplication();
});

function initializeApplication() {
    // Get main containers
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('app');
    
    if (!loadingScreen || !loginScreen || !mainApp) {
        console.error('Required containers not found');
        return;
    }
    
    console.log('All containers found, setting up application...');
    
    // Set initial state
    loadingScreen.style.display = 'flex';
    loginScreen.style.display = 'none';
    mainApp.style.display = 'none';
    
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        verifyToken(token);
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    console.log('Showing login screen...');
    
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        setupLoginHandlers();
    }, 1500);
}

function setupLoginHandlers() {
    console.log('Setting up login handlers...');
    
    // Login form
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }
    
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('Handling login...');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Login successful');
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showMainApplication();
        } else {
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('Handling registration...');
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role')
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showMainApplication();
        } else {
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

async function verifyToken(token) {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showMainApplication();
        } else {
            localStorage.clear();
            showLoginScreen();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.clear();
        showLoginScreen();
    }
}

function showMainApplication() {
    console.log('Showing main application...');
    
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    
    // Update user info in both sidebar and header
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const headerUserName = document.getElementById('user-name');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserEmail = document.getElementById('dropdown-user-email');
    const dropdownUserRole = document.getElementById('dropdown-user-role');
    
    if (currentUser) {
        const displayName = currentUser.username || 'User';
        const displayEmail = currentUser.email || 'user@example.com';
        const displayRole = currentUser.role || 'employee';
        
        if (sidebarUserName) sidebarUserName.textContent = displayName;
        if (headerUserName) headerUserName.textContent = displayName;
        if (dropdownUserName) dropdownUserName.textContent = displayName;
        if (dropdownUserEmail) dropdownUserEmail.textContent = displayEmail;
        if (dropdownUserRole) {
            dropdownUserRole.textContent = displayRole;
            // Add role-specific class for styling
            dropdownUserRole.className = `user-role ${displayRole}`;
        }
    }
    
    // Setup navigation and other handlers
    setupMainAppHandlers();
    
    // Load dashboard by default
    showPage('dashboard');
}

function setupMainAppHandlers() {
    console.log('Setting up main app handlers...');
    
    // Navigation menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            if (page) {
                showPage(page);
            }
        });
    });
    
    // User profile dropdown
    setupUserProfileDropdown();
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Profile menu items
    setupProfileMenuItems();
    
    // Sidebar toggle
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('open');
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown-menu');
        const trigger = document.getElementById('user-profile-trigger');
        
        if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
            closeUserDropdown();
        }
    });
}

function setupUserProfileDropdown() {
    const trigger = document.getElementById('user-profile-trigger');
    const dropdown = document.getElementById('user-dropdown-menu');
    
    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserDropdown();
        });
    }
}

function toggleUserDropdown() {
    const trigger = document.getElementById('user-profile-trigger');
    const dropdown = document.getElementById('user-dropdown-menu');
    
    if (trigger && dropdown) {
        const isActive = dropdown.classList.contains('active');
        
        if (isActive) {
            closeUserDropdown();
        } else {
            openUserDropdown();
        }
    }
}

function openUserDropdown() {
    const trigger = document.getElementById('user-profile-trigger');
    const dropdown = document.getElementById('user-dropdown-menu');
    
    if (trigger && dropdown) {
        trigger.classList.add('active');
        dropdown.classList.add('active');
    }
}

function closeUserDropdown() {
    const trigger = document.getElementById('user-profile-trigger');
    const dropdown = document.getElementById('user-dropdown-menu');
    
    if (trigger && dropdown) {
        trigger.classList.remove('active');
        dropdown.classList.remove('active');
    }
}

function setupProfileMenuItems() {
    // Profile Settings
    const profileSettings = document.getElementById('profile-settings');
    if (profileSettings) {
        profileSettings.addEventListener('click', (e) => {
            e.preventDefault();
            closeUserDropdown();
            showToast('Profile Settings feature coming soon!', 'info');
        });
    }
    
    // Change Password
    const changePassword = document.getElementById('change-password');
    if (changePassword) {
        changePassword.addEventListener('click', (e) => {
            e.preventDefault();
            closeUserDropdown();
            showToast('Change Password feature coming soon!', 'info');
        });
    }
    
    // Preferences
    const preferences = document.getElementById('preferences');
    if (preferences) {
        preferences.addEventListener('click', (e) => {
            e.preventDefault();
            closeUserDropdown();
            showToast('Preferences feature coming soon!', 'info');
        });
    }
}

function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeMenuItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
    
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
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = titles[pageId] || 'HR Pro';
    }
    
    // Show/hide pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    currentPage = pageId;
    
    // Load page-specific data
    loadPageData(pageId);
}

async function loadPageData(pageId) {
    console.log('Loading data for page:', pageId);
    
    switch (pageId) {
        case 'dashboard':
            await loadDashboardData();
            break;
        case 'employees':
            await loadEmployeesData();
            setupEmployeePageHandlers();
            break;
        case 'attendance':
            await loadAttendanceData();
            break;
        case 'leaves':
            await loadLeavesData();
            setupLeavePageHandlers();
            break;
        case 'payroll':
            await loadPayrollData();
            setupPayrollPageHandlers();
            break;
        // Add other cases as needed
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            updateDashboardStats(stats);
        } else {
            console.error('Failed to load dashboard stats');
        }
    } catch (error) {
        console.error('Dashboard loading error:', error);
    }
}

function updateDashboardStats(stats) {
    const elements = {
        'total-employees': stats.employees?.total || 0,
        'present-today': stats.attendance?.present || 0,
        'pending-leaves': stats.leaves?.pending || 0,
        'monthly-payroll': '₹' + Math.round(stats.payroll?.monthlyTotal || 0).toLocaleString('en-IN')
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
    
    // Create department distribution chart with real data
    if (stats.departments && stats.departments.length > 0) {
        createDepartmentChart(stats.departments);
    }
    
    // Create employee growth chart
    loadEmployeeGrowthChart();
}

async function loadEmployeesData() {
    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayEmployees(data.employees || []);
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

function displayEmployees(employees) {
    const tbody = document.querySelector('#employees-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--gray-500);">No employees found</td></tr>';
        return;
    }
    
    employees.forEach(employee => {
        const row = document.createElement('tr');
        
        // Format joining date
        const joiningDate = new Date(employee.employment.dateOfJoining).toLocaleDateString('en-IN');
        
        // Calculate monthly salary
        const monthlySalary = employee.salaryStructure?.ctc ? 
            Math.round(employee.salaryStructure.ctc / 12).toLocaleString('en-IN') : 'N/A';
        
        row.innerHTML = `
            <td><strong>${employee.employeeId}</strong></td>
            <td>
                <div class="employee-info">
                    <div class="employee-name">${employee.personalInfo.firstName} ${employee.personalInfo.lastName}</div>
                </div>
            </td>
            <td>${employee.personalInfo.email}</td>
            <td>${employee.employment.department}</td>
            <td>${employee.employment.designation}</td>
            <td>
                <span class="employment-type">${employee.employment.employmentType}</span>
            </td>
            <td>${joiningDate}</td>
            <td>
                <span class="status-badge status-${employee.employment.status}">
                    ${employee.employment.status}
                </span>
            </td>
            <td>₹${monthlySalary}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-view" onclick="viewEmployee('${employee._id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-sm btn-edit" onclick="editEmployee('${employee._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-sm btn-delete" onclick="deleteEmployee('${employee._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Update employee count
    const countElement = document.getElementById('employee-count');
    if (countElement) {
        countElement.textContent = `Showing ${employees.length} employees`;
    }
}

function setupEmployeePageHandlers() {
    const addBtn = document.getElementById('add-employee-btn');
    if (addBtn && !addBtn.hasAttribute('data-listener-attached')) {
        addBtn.addEventListener('click', () => {
            openEmployeeModal();
        });
        addBtn.setAttribute('data-listener-attached', 'true');
    }
    
    const bulkImportBtn = document.getElementById('bulk-import-btn');
    if (bulkImportBtn && !bulkImportBtn.hasAttribute('data-listener-attached')) {
        bulkImportBtn.addEventListener('click', () => {
            showToast('Bulk import functionality coming soon!', 'info');
        });
        bulkImportBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Setup filter handlers
    setupEmployeeFilters();
    
    // Setup form tab handlers
    setupFormTabs();
}

function setupEmployeeFilters() {
    const searchInput = document.getElementById('employee-search');
    const departmentFilter = document.getElementById('department-filter');
    const statusFilter = document.getElementById('status-filter');
    const employmentTypeFilter = document.getElementById('employment-type-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterEmployees, 300));
    }
    
    if (departmentFilter) {
        departmentFilter.addEventListener('change', filterEmployees);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', filterEmployees);
    }
    
    if (employmentTypeFilter) {
        employmentTypeFilter.addEventListener('change', filterEmployees);
    }
}

function filterEmployees() {
    const search = document.getElementById('employee-search')?.value || '';
    const department = document.getElementById('department-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    const employmentType = document.getElementById('employment-type-filter')?.value || '';
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    if (employmentType) params.append('employmentType', employmentType);
    
    loadEmployeesData(params.toString());
}

async function loadEmployeesData(queryParams = '') {
    try {
        const url = `/api/employees${queryParams ? '?' + queryParams : ''}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayEmployees(data.employees || []);
        } else {
            showToast('Failed to load employees', 'error');
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        showToast('Error loading employees', 'error');
    }
}

// Employee Modal Functions - Enhanced version is at the end of the file

function closeEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function loadEmployeeData(employeeId) {
    try {
        const response = await fetch(`/api/employees/${employeeId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const employee = await response.json();
            populateEmployeeForm(employee);
        } else {
            showToast('Failed to load employee data', 'error');
        }
    } catch (error) {
        console.error('Error loading employee:', error);
        showToast('Error loading employee data', 'error');
    }
}

function populateEmployeeForm(employee) {
    // Personal Info
    document.getElementById('employeeId').value = employee.employeeId || '';
    document.getElementById('firstName').value = employee.personalInfo?.firstName || '';
    document.getElementById('lastName').value = employee.personalInfo?.lastName || '';
    document.getElementById('email').value = employee.personalInfo?.email || '';
    document.getElementById('phone').value = employee.personalInfo?.phone || '';
    document.getElementById('dateOfBirth').value = employee.personalInfo?.dateOfBirth ? 
        new Date(employee.personalInfo.dateOfBirth).toISOString().split('T')[0] : '';
    document.getElementById('gender').value = employee.personalInfo?.gender || '';
    document.getElementById('maritalStatus').value = employee.personalInfo?.maritalStatus || '';
    
    // Address
    document.getElementById('street').value = employee.personalInfo?.address?.street || '';
    document.getElementById('city').value = employee.personalInfo?.address?.city || '';
    document.getElementById('state').value = employee.personalInfo?.address?.state || '';
    document.getElementById('zipCode').value = employee.personalInfo?.address?.zipCode || '';
    
    // Documents
    document.getElementById('panNumber').value = employee.personalInfo?.panNumber || '';
    document.getElementById('aadhaarNumber').value = employee.personalInfo?.aadhaarNumber || '';
    document.getElementById('passportNumber').value = employee.personalInfo?.passportNumber || '';
    
    // Emergency Contact
    document.getElementById('emergencyName').value = employee.personalInfo?.emergencyContact?.name || '';
    document.getElementById('emergencyRelationship').value = employee.personalInfo?.emergencyContact?.relationship || '';
    document.getElementById('emergencyPhone').value = employee.personalInfo?.emergencyContact?.phone || '';
    
    // Employment
    document.getElementById('department').value = employee.employment?.department || '';
    document.getElementById('designation').value = employee.employment?.designation || '';
    document.getElementById('role').value = employee.employment?.role || '';
    document.getElementById('employmentType').value = employee.employment?.employmentType || '';
    document.getElementById('employmentStatus').value = employee.employment?.status || 'active';
    document.getElementById('dateOfJoining').value = employee.employment?.dateOfJoining ? 
        new Date(employee.employment.dateOfJoining).toISOString().split('T')[0] : '';
    document.getElementById('workLocation').value = employee.employment?.workLocation || '';
    document.getElementById('probationPeriod').value = employee.employment?.probationPeriod || '';
    document.getElementById('noticePeriod').value = employee.employment?.noticePeriod || '';
    
    // Salary Structure
    document.getElementById('ctc').value = employee.salaryStructure?.ctc || '';
    document.getElementById('basicSalary').value = employee.salaryStructure?.basicSalary || '';
    document.getElementById('hra').value = employee.salaryStructure?.hra || '';
    document.getElementById('specialAllowance').value = employee.salaryStructure?.specialAllowance || '';
    document.getElementById('transportAllowance').value = employee.salaryStructure?.transportAllowance || '';
    document.getElementById('medicalAllowance').value = employee.salaryStructure?.medicalAllowance || '';
    
    // Tax Info
    document.getElementById('pfNumber').value = employee.taxInfo?.pfNumber || '';
    document.getElementById('esiNumber').value = employee.taxInfo?.esiNumber || '';
    document.getElementById('uanNumber').value = employee.taxInfo?.uanNumber || '';
    document.getElementById('taxRegime').value = employee.taxInfo?.taxRegime || '';
    
    // Bank Details
    document.getElementById('accountNumber').value = employee.bankDetails?.accountNumber || '';
    document.getElementById('ifscCode').value = employee.bankDetails?.ifscCode || '';
    document.getElementById('bankName').value = employee.bankDetails?.bankName || '';
    document.getElementById('branchName').value = employee.bankDetails?.branchName || '';
    document.getElementById('accountType').value = employee.bankDetails?.accountType || '';
    document.getElementById('accountHolderName').value = employee.bankDetails?.accountHolderName || '';
}

async function handleEmployeeFormSubmit(e, employeeId) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const formData = new FormData(e.target);
        const employeeData = {};
        
        // Convert FormData to nested object structure
        for (let [key, value] of formData.entries()) {
            if (value.trim() !== '') { // Only include non-empty values
                setNestedProperty(employeeData, key, value);
            }
        }
        
        // Validate required fields
        const validationErrors = validateEmployeeData(employeeData);
        if (validationErrors.length > 0) {
            showToast(`Validation Error: ${validationErrors.join(', ')}`, 'error');
            return;
        }
        
        // Auto-generate Employee ID if not provided
        if (!employeeData.employeeId && !employeeId) {
            employeeData.employeeId = await generateEmployeeId();
        }
        
        // Calculate salary components if not provided
        if (employeeData.salaryStructure) {
            calculateSalaryComponents(employeeData.salaryStructure);
        }
        
        console.log('Submitting employee data:', employeeData);
        
        const url = employeeId ? `/api/employees/${employeeId}` : '/api/employees';
        const method = employeeId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(employeeData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || `Employee ${employeeId ? 'updated' : 'created'} successfully!`, 'success');
            closeEmployeeModal();
            loadEmployeesData(); // Reload the employee list
        } else {
            console.error('Server error:', result);
            if (result.errors && Array.isArray(result.errors)) {
                const errorMessages = result.errors.map(err => err.msg || err.message).join(', ');
                showToast(`Error: ${errorMessages}`, 'error');
            } else {
                showToast(result.message || 'Failed to save employee', 'error');
            }
        }
    } catch (error) {
        console.error('Error saving employee:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// Validate employee data
function validateEmployeeData(data) {
    const errors = [];
    
    // Required fields validation
    if (!data.employeeId) errors.push('Employee ID is required');
    if (!data.personalInfo?.firstName) errors.push('First Name is required');
    if (!data.personalInfo?.lastName) errors.push('Last Name is required');
    if (!data.personalInfo?.email) errors.push('Email is required');
    if (!data.personalInfo?.phone) errors.push('Phone Number is required');
    if (!data.employment?.department) errors.push('Department is required');
    if (!data.employment?.designation) errors.push('Designation is required');
    if (!data.employment?.role) errors.push('Role is required');
    if (!data.employment?.employmentType) errors.push('Employment Type is required');
    if (!data.employment?.dateOfJoining) errors.push('Date of Joining is required');
    if (!data.salaryStructure?.ctc) errors.push('Annual CTC is required');
    if (!data.salaryStructure?.basicSalary) errors.push('Basic Salary is required');
    if (!data.bankDetails?.accountNumber) errors.push('Account Number is required');
    if (!data.bankDetails?.ifscCode) errors.push('IFSC Code is required');
    if (!data.bankDetails?.bankName) errors.push('Bank Name is required');
    if (!data.bankDetails?.accountHolderName) errors.push('Account Holder Name is required');
    
    // Email validation
    if (data.personalInfo?.email && !isValidEmail(data.personalInfo.email)) {
        errors.push('Please enter a valid email address');
    }
    
    // Phone validation
    if (data.personalInfo?.phone && !isValidPhone(data.personalInfo.phone)) {
        errors.push('Please enter a valid phone number');
    }
    
    // PAN validation
    if (data.personalInfo?.panNumber && !isValidPAN(data.personalInfo.panNumber)) {
        errors.push('Please enter a valid PAN number (e.g., ABCDE1234F)');
    }
    
    // IFSC validation
    if (data.bankDetails?.ifscCode && !isValidIFSC(data.bankDetails.ifscCode)) {
        errors.push('Please enter a valid IFSC code (e.g., HDFC0001234)');
    }
    
    // Salary validation
    if (data.salaryStructure?.ctc && data.salaryStructure?.basicSalary) {
        if (parseInt(data.salaryStructure.basicSalary) > parseInt(data.salaryStructure.ctc)) {
            errors.push('Basic Salary cannot be greater than CTC');
        }
    }
    
    return errors;
}

// Generate unique employee ID
async function generateEmployeeId() {
    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const employeeCount = data.total || 0;
            return `EMP${String(employeeCount + 1).padStart(3, '0')}`;
        }
    } catch (error) {
        console.error('Error generating employee ID:', error);
    }
    
    // Fallback to timestamp-based ID
    return `EMP${Date.now().toString().slice(-6)}`;
}

// Calculate salary components
function calculateSalaryComponents(salaryStructure) {
    const ctc = parseInt(salaryStructure.ctc) || 0;
    const basicSalary = parseInt(salaryStructure.basicSalary) || 0;
    
    // Auto-calculate HRA if not provided (40% of basic)
    if (!salaryStructure.hra && basicSalary > 0) {
        salaryStructure.hra = Math.round(basicSalary * 0.4);
    }
    
    // Auto-calculate special allowance if not provided
    if (!salaryStructure.specialAllowance && ctc > 0 && basicSalary > 0) {
        const hra = parseInt(salaryStructure.hra) || 0;
        const transport = parseInt(salaryStructure.transportAllowance) || 1600;
        const medical = parseInt(salaryStructure.medicalAllowance) || 1250;
        const remaining = ctc - basicSalary - hra - (transport * 12) - (medical * 12);
        
        if (remaining > 0) {
            salaryStructure.specialAllowance = Math.round(remaining);
        }
    }
}

// Validation helper functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[0-9\-\s\(\)]{10,15}$/;
    return phoneRegex.test(phone);
}

function isValidPAN(pan) {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
}

function isValidIFSC(ifsc) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
}

// Form Tab Management
function setupFormTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Global functions for employee actions
function viewEmployee(id) {
    showToast('View Employee functionality coming soon!', 'info');
}

function editEmployee(id) {
    openEmployeeModal(id);
}

async function deleteEmployee(id) {
    if (!confirm('Are you sure you want to delete this employee?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/employees/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Employee deleted successfully', 'success');
            loadEmployeesData(); // Reload the employee list
        } else {
            showToast(result.message || 'Failed to delete employee', 'error');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        showToast('Error deleting employee', 'error');
    }
}

// Utility Functions
function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleLogout() {
    // Close the dropdown first
    closeUserDropdown();
    
    // Clear user data
    localStorage.clear();
    currentUser = null;
    
    // Show login screen
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    
    showToast('Logged out successfully', 'info');
}

function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showToast(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add icon based on type
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i> ';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i> ';
            break;
        case 'info':
            icon = '<i class="fas fa-info-circle"></i> ';
            break;
        default:
            icon = '<i class="fas fa-bell"></i> ';
    }
    
    toast.innerHTML = icon + message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
    
    // Add click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    });
}

// Global functions for button actions
function editEmployee(id) {
    openEmployeeModal(id);
}

// Chart creation function
function createDepartmentChart(departments) {
    const canvas = document.getElementById('department-chart');
    if (!canvas) return;
    
    // Destroy existing chart if it exists
    if (window.departmentChart) {
        window.departmentChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Prepare data
    const labels = departments.map(dept => dept._id);
    const data = departments.map(dept => dept.count);
    const colors = [
        '#667eea',
        '#764ba2', 
        '#f093fb',
        '#f5576c',
        '#4facfe',
        '#43e97b',
        '#fa709a',
        '#fee140'
    ];
    
    window.departmentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderWidth: 2,
                borderColor: '#fff'
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
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Employee Growth Chart
async function loadEmployeeGrowthChart() {
    try {
        const response = await fetch('/api/dashboard/charts/employee-growth?period=year', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            createEmployeeGrowthChart(data);
        } else {
            console.error('Failed to load employee growth data');
        }
    } catch (error) {
        console.error('Employee growth chart loading error:', error);
    }
}

function createEmployeeGrowthChart(data) {
    const canvas = document.getElementById('employee-growth-chart');
    if (!canvas) return;
    
    // Destroy existing chart if it exists
    if (window.employeeGrowthChart) {
        window.employeeGrowthChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Prepare data
    const labels = data.map(item => item.period);
    const newEmployees = data.map(item => item.count);
    const totalEmployees = data.map(item => item.cumulative);
    
    window.employeeGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Employees',
                    data: totalEmployees,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                },
                {
                    label: 'New Hires',
                    data: newEmployees,
                    borderColor: '#43e97b',
                    backgroundColor: 'rgba(67, 233, 123, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#43e97b',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            return `Period: ${context[0].label}`;
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time Period',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Number of Employees',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

console.log('HR Pro application script loaded successfully');
// Auto-calculation for salary components
function setupSalaryCalculation() {
    const ctcInput = document.getElementById('ctc');
    const basicSalaryInput = document.getElementById('basicSalary');
    const hraInput = document.getElementById('hra');
    const specialAllowanceInput = document.getElementById('specialAllowance');
    
    if (ctcInput && basicSalaryInput) {
        // Auto-calculate HRA when basic salary changes
        basicSalaryInput.addEventListener('input', () => {
            const basicSalary = parseInt(basicSalaryInput.value) || 0;
            if (basicSalary > 0 && !hraInput.value) {
                hraInput.value = Math.round(basicSalary * 0.4); // 40% of basic
                calculateSpecialAllowance();
            }
        });
        
        // Auto-calculate special allowance when CTC or other components change
        ctcInput.addEventListener('input', calculateSpecialAllowance);
        hraInput.addEventListener('input', calculateSpecialAllowance);
        
        function calculateSpecialAllowance() {
            const ctc = parseInt(ctcInput.value) || 0;
            const basicSalary = parseInt(basicSalaryInput.value) || 0;
            const hra = parseInt(hraInput.value) || 0;
            const transport = parseInt(document.getElementById('transportAllowance').value) || 1600;
            const medical = parseInt(document.getElementById('medicalAllowance').value) || 1250;
            
            if (ctc > 0 && basicSalary > 0 && !specialAllowanceInput.value) {
                const remaining = ctc - basicSalary - hra - (transport * 12) - (medical * 12);
                if (remaining > 0) {
                    specialAllowanceInput.value = Math.round(remaining);
                }
            }
        }
    }
}

// Call this function when the modal opens
function openEmployeeModal(employeeId = null) {
    const modal = document.getElementById('employee-modal');
    const title = document.getElementById('employee-modal-title');
    const form = document.getElementById('employee-form');
    
    if (!modal || !title || !form) return;
    
    // Reset form
    form.reset();
    
    if (employeeId) {
        title.textContent = 'Edit Employee';
        loadEmployeeData(employeeId);
    } else {
        title.textContent = 'Add New Employee';
        // Set default values for new employee
        document.getElementById('employmentStatus').value = 'active';
        document.getElementById('employmentType').value = 'full-time';
        document.getElementById('taxRegime').value = 'new';
        document.getElementById('accountType').value = 'savings';
        document.getElementById('transportAllowance').value = '1600';
        document.getElementById('medicalAllowance').value = '1250';
        document.getElementById('probationPeriod').value = '6';
        document.getElementById('noticePeriod').value = '30';
    }
    
    modal.classList.add('active');
    
    // Setup form submission
    form.onsubmit = (e) => handleEmployeeFormSubmit(e, employeeId);
    
    // Setup salary calculation
    setupSalaryCalculation();
    
    // Focus on first input
    setTimeout(() => {
        const firstInput = form.querySelector('input:not([type="hidden"])');
        if (firstInput) firstInput.focus();
    }, 100);
}

// ===== ATTENDANCE MANAGEMENT FUNCTIONS =====

// Load attendance page data
async function loadAttendanceData() {
    try {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('attendance-date').value = today;

        // Load employees for filters
        await loadEmployeesForAttendance();
        
        // Load today's attendance summary
        await loadTodayAttendanceSummary();
        
        // Load attendance records
        await loadAttendanceRecords();
        
        // Setup attendance page handlers
        setupAttendancePageHandlers();
    } catch (error) {
        console.error('Error loading attendance data:', error);
        showToast('Error loading attendance data', 'error');
    }
}

// Load employees for attendance filters and forms
async function loadEmployeesForAttendance() {
    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const employees = data.employees || [];
            
            // Populate employee dropdowns
            const selects = [
                'attendance-employee',
                'manual-employee',
                'pay-calc-employee'
            ];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Select Employee</option>';
                    employees.forEach(employee => {
                        const option = document.createElement('option');
                        option.value = employee._id;
                        option.textContent = `${employee.employeeId} - ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
                        select.appendChild(option);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error loading employees for attendance:', error);
    }
}

// Load today's attendance summary
async function loadTodayAttendanceSummary() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/attendance/daily-report?date=${today}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const summary = data.summary;
            
            // Update summary cards
            document.getElementById('today-present').textContent = summary.present || 0;
            document.getElementById('today-absent').textContent = summary.absent || 0;
            document.getElementById('today-wfh').textContent = summary.wfh || 0;
            document.getElementById('today-late').textContent = summary.late || 0;
        }
    } catch (error) {
        console.error('Error loading today\'s attendance summary:', error);
    }
}

// Load attendance records
async function loadAttendanceRecords() {
    try {
        const params = new URLSearchParams();
        
        // Get filter values
        const date = document.getElementById('attendance-date')?.value;
        const employeeId = document.getElementById('attendance-employee')?.value;
        const status = document.getElementById('attendance-status')?.value;
        const department = document.getElementById('attendance-department')?.value;
        
        if (date) {
            params.append('startDate', date);
            params.append('endDate', date);
        }
        if (employeeId) params.append('employeeId', employeeId);
        if (status) params.append('status', status);
        
        const url = `/api/attendance${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayAttendanceRecords(data.attendanceRecords || []);
            
            // Update count
            const countElement = document.getElementById('attendance-count');
            if (countElement) {
                countElement.textContent = `Showing ${data.attendanceRecords.length} records`;
            }
        } else {
            showToast('Failed to load attendance records', 'error');
        }
    } catch (error) {
        console.error('Error loading attendance records:', error);
        showToast('Error loading attendance records', 'error');
    }
}

// Display attendance records in table
function displayAttendanceRecords(records) {
    const tbody = document.querySelector('#attendance-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--gray-500);">No attendance records found</td></tr>';
        return;
    }
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // Format times
        const checkInTime = record.checkIn?.time ? 
            new Date(record.checkIn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
        const checkOutTime = record.checkOut?.time ? 
            new Date(record.checkOut.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
        
        // Format date
        const date = new Date(record.date).toLocaleDateString('en-IN');
        
        // Working hours
        const workingHours = record.workingHours?.productiveHours ? 
            record.workingHours.productiveHours.toFixed(1) + 'h' : '0h';
        
        // Overtime hours
        const overtimeHours = record.workingHours?.overtimeHours ? 
            record.workingHours.overtimeHours.toFixed(1) + 'h' : '0h';
        
        // Late status
        const lateStatus = record.lateArrival?.isLate ? 
            `${record.lateArrival.lateByMinutes}min` : '-';
        
        // Employee name
        const employeeName = record.employeeId ? 
            `${record.employeeId.personalInfo.firstName} ${record.employeeId.personalInfo.lastName}` : 'Unknown';
        
        row.innerHTML = `
            <td>
                <div class="employee-info">
                    <div class="employee-name">${employeeName}</div>
                    <div class="employee-id">${record.employeeId?.employeeId || 'N/A'}</div>
                </div>
            </td>
            <td>${date}</td>
            <td>
                <span class="status-badge status-${record.status}">
                    ${record.status.replace('-', ' ')}
                </span>
                ${record.workFromHome?.isWFH ? '<i class="fas fa-home" title="Work from Home"></i>' : ''}
            </td>
            <td>${checkInTime}</td>
            <td>${checkOutTime}</td>
            <td>${workingHours}</td>
            <td>${overtimeHours}</td>
            <td>
                ${record.lateArrival?.isLate ? 
                    `<span class="late-badge">${lateStatus}</span>` : 
                    '<span class="on-time-badge">On Time</span>'
                }
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-view" onclick="viewAttendanceDetails('${record._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${currentUser && ['admin', 'hr'].includes(currentUser.role) ? `
                        <button class="btn-sm btn-edit" onclick="editAttendanceRecord('${record._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-sm btn-delete" onclick="deleteAttendanceRecord('${record._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                    <button class="btn-sm btn-calculate" onclick="calculateEmployeePay('${record.employeeId?._id}')">
                        <i class="fas fa-calculator"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Setup attendance page handlers
function setupAttendancePageHandlers() {
    // Manual attendance entry button
    const manualBtn = document.getElementById('manual-attendance-btn');
    if (manualBtn && !manualBtn.hasAttribute('data-listener-attached')) {
        manualBtn.addEventListener('click', openManualAttendanceModal);
        manualBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Daily report button
    const reportBtn = document.getElementById('daily-report-btn');
    if (reportBtn && !reportBtn.hasAttribute('data-listener-attached')) {
        reportBtn.addEventListener('click', openDailyReportModal);
        reportBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Filter handlers
    const filters = ['attendance-date', 'attendance-employee', 'attendance-status', 'attendance-department'];
    filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter && !filter.hasAttribute('data-listener-attached')) {
            filter.addEventListener('change', loadAttendanceRecords);
            filter.setAttribute('data-listener-attached', 'true');
        }
    });
    
    // Manual attendance form
    const manualForm = document.getElementById('manual-attendance-form');
    if (manualForm && !manualForm.hasAttribute('data-listener-attached')) {
        manualForm.addEventListener('submit', handleManualAttendanceSubmit);
        manualForm.setAttribute('data-listener-attached', 'true');
    }
    
    // Pay calculator
    const calcBtn = document.getElementById('calculate-pay-btn');
    if (calcBtn && !calcBtn.hasAttribute('data-listener-attached')) {
        calcBtn.addEventListener('click', handlePayCalculation);
        calcBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Daily report generator
    const genReportBtn = document.getElementById('generate-report-btn');
    if (genReportBtn && !genReportBtn.hasAttribute('data-listener-attached')) {
        genReportBtn.addEventListener('click', handleDailyReportGeneration);
        genReportBtn.setAttribute('data-listener-attached', 'true');
    }
}

// Open manual attendance modal
function openManualAttendanceModal(attendanceId = null) {
    const modal = document.getElementById('manual-attendance-modal');
    const title = document.getElementById('manual-attendance-title');
    const form = document.getElementById('manual-attendance-form');
    
    if (!modal || !title || !form) return;
    
    // Reset form
    form.reset();
    
    if (attendanceId) {
        title.textContent = 'Edit Attendance Record';
        // Load attendance data for editing
        loadAttendanceForEdit(attendanceId);
    } else {
        title.textContent = 'Manual Attendance Entry';
        // Set default date to today
        document.getElementById('manual-date').value = new Date().toISOString().split('T')[0];
    }
    
    modal.classList.add('active');
}

// Close manual attendance modal
function closeManualAttendanceModal() {
    const modal = document.getElementById('manual-attendance-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Handle manual attendance form submission
async function handleManualAttendanceSubmit(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const formData = new FormData(e.target);
        const attendanceData = {};
        
        // Convert FormData to object
        for (let [key, value] of formData.entries()) {
            if (value.trim() !== '') {
                attendanceData[key] = value;
            }
        }
        
        // Validate required fields
        if (!attendanceData.employeeId || !attendanceData.date || !attendanceData.status) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        const response = await fetch('/api/attendance/manual-entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(attendanceData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Attendance record saved successfully!', 'success');
            closeManualAttendanceModal();
            loadAttendanceRecords(); // Reload the attendance list
            loadTodayAttendanceSummary(); // Refresh summary
        } else {
            if (result.errors && Array.isArray(result.errors)) {
                const errorMessages = result.errors.map(err => err.msg || err.message).join(', ');
                showToast(`Error: ${errorMessages}`, 'error');
            } else {
                showToast(result.message || 'Failed to save attendance record', 'error');
            }
        }
    } catch (error) {
        console.error('Error saving attendance record:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// Open pay calculator modal
function openPayCalculatorModal() {
    const modal = document.getElementById('pay-calculator-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Set default dates (current month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        document.getElementById('pay-calc-start-date').value = startOfMonth.toISOString().split('T')[0];
        document.getElementById('pay-calc-end-date').value = endOfMonth.toISOString().split('T')[0];
    }
}

// Close pay calculator modal
function closePayCalculatorModal() {
    const modal = document.getElementById('pay-calculator-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Calculate employee pay
function calculateEmployeePay(employeeId) {
    openPayCalculatorModal();
    if (employeeId) {
        document.getElementById('pay-calc-employee').value = employeeId;
    }
}

// Handle pay calculation
async function handlePayCalculation() {
    const employeeId = document.getElementById('pay-calc-employee').value;
    const startDate = document.getElementById('pay-calc-start-date').value;
    const endDate = document.getElementById('pay-calc-end-date').value;
    
    if (!employeeId || !startDate || !endDate) {
        showToast('Please select employee and date range', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/attendance/calculate-pay/${employeeId}?startDate=${startDate}&endDate=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayPayCalculationResult(data);
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to calculate pay', 'error');
        }
    } catch (error) {
        console.error('Error calculating pay:', error);
        showToast('Error calculating pay', 'error');
    }
}

// Display pay calculation result
function displayPayCalculationResult(data) {
    const resultDiv = document.getElementById('pay-calculation-result');
    if (!resultDiv) return;
    
    const attendancePercentage = data.attendance.attendancePercentage;
    const attendanceColor = attendancePercentage >= 90 ? 'green' : attendancePercentage >= 75 ? 'orange' : 'red';
    
    resultDiv.innerHTML = `
        <div class="pay-calculation-card">
            <div class="pay-calc-header">
                <h4>${data.employee.name} (${data.employee.employeeId})</h4>
                <p>${data.employee.department} - ${data.employee.designation}</p>
                <p>Period: ${new Date(data.period.startDate).toLocaleDateString()} to ${new Date(data.period.endDate).toLocaleDateString()}</p>
            </div>
            
            <div class="pay-calc-grid">
                <div class="pay-calc-section">
                    <h5>Attendance Summary</h5>
                    <div class="attendance-stats">
                        <div class="stat-item">
                            <span class="stat-label">Present Days:</span>
                            <span class="stat-value">${data.attendance.presentDays}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">WFH Days:</span>
                            <span class="stat-value">${data.attendance.wfhDays}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Half Days:</span>
                            <span class="stat-value">${data.attendance.halfDays}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Absent Days:</span>
                            <span class="stat-value">${data.attendance.absentDays}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">LOP Days:</span>
                            <span class="stat-value">${data.attendance.lopDays}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Working Hours:</span>
                            <span class="stat-value">${data.attendance.totalWorkingHours}h</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Overtime Hours:</span>
                            <span class="stat-value">${data.attendance.totalOvertimeHours}h</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Attendance %:</span>
                            <span class="stat-value" style="color: ${attendanceColor}; font-weight: bold;">
                                ${attendancePercentage}%
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="pay-calc-section">
                    <h5>Pay Calculation</h5>
                    <div class="pay-stats">
                        <div class="stat-item">
                            <span class="stat-label">Monthly Salary:</span>
                            <span class="stat-value">₹${data.salary.monthlySalary.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Daily Rate:</span>
                            <span class="stat-value">₹${data.salary.dailyRate.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Basic Pay:</span>
                            <span class="stat-value">₹${data.payCalculation.basicPay.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Overtime Pay:</span>
                            <span class="stat-value">₹${data.payCalculation.overtimePay.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">LOP Deduction:</span>
                            <span class="stat-value text-red">-₹${data.payCalculation.lopAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Gross Pay:</span>
                            <span class="stat-value">₹${data.payCalculation.grossPay.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="stat-item total-pay">
                            <span class="stat-label">Net Pay:</span>
                            <span class="stat-value">₹${data.payCalculation.netPay.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    resultDiv.style.display = 'block';
}

// Open daily report modal
function openDailyReportModal() {
    const modal = document.getElementById('daily-report-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Set default date to today
        document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
    }
}

// Close daily report modal
function closeDailyReportModal() {
    const modal = document.getElementById('daily-report-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Handle daily report generation
async function handleDailyReportGeneration() {
    const date = document.getElementById('report-date').value;
    const department = document.getElementById('report-department').value;
    
    if (!date) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        const params = new URLSearchParams({ date });
        if (department) params.append('department', department);
        
        const response = await fetch(`/api/attendance/daily-report?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayDailyReportResult(data);
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to generate report', 'error');
        }
    } catch (error) {
        console.error('Error generating daily report:', error);
        showToast('Error generating daily report', 'error');
    }
}

// Display daily report result
function displayDailyReportResult(data) {
    const resultDiv = document.getElementById('daily-report-result');
    if (!resultDiv) return;
    
    const summary = data.summary;
    const employees = data.employees;
    
    resultDiv.innerHTML = `
        <div class="daily-report-card">
            <div class="report-header">
                <h4>Daily Attendance Report - ${new Date(data.date).toLocaleDateString('en-IN')}</h4>
            </div>
            
            <div class="report-summary">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-number">${summary.totalEmployees}</span>
                        <span class="stat-label">Total</span>
                    </div>
                    <div class="summary-stat present">
                        <span class="stat-number">${summary.present}</span>
                        <span class="stat-label">Present</span>
                    </div>
                    <div class="summary-stat absent">
                        <span class="stat-number">${summary.absent}</span>
                        <span class="stat-label">Absent</span>
                    </div>
                    <div class="summary-stat wfh">
                        <span class="stat-number">${summary.wfh}</span>
                        <span class="stat-label">WFH</span>
                    </div>
                    <div class="summary-stat half-day">
                        <span class="stat-number">${summary.halfDay}</span>
                        <span class="stat-label">Half Day</span>
                    </div>
                    <div class="summary-stat late">
                        <span class="stat-number">${summary.late}</span>
                        <span class="stat-label">Late</span>
                    </div>
                </div>
            </div>
            
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Hours</th>
                            <th>Late</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${employees.map(emp => `
                            <tr>
                                <td>
                                    <div class="employee-info">
                                        <div class="employee-name">${emp.employee.name}</div>
                                        <div class="employee-id">${emp.employee.employeeId}</div>
                                    </div>
                                </td>
                                <td>${emp.employee.department}</td>
                                <td>
                                    <span class="status-badge status-${emp.attendance.status}">
                                        ${emp.attendance.status.replace('-', ' ')}
                                    </span>
                                    ${emp.attendance.isWFH ? '<i class="fas fa-home" title="WFH"></i>' : ''}
                                </td>
                                <td>${emp.attendance.checkIn ? new Date(emp.attendance.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                <td>${emp.attendance.checkOut ? new Date(emp.attendance.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                <td>${emp.attendance.workingHours}h</td>
                                <td>
                                    ${emp.attendance.isLate ? 
                                        `<span class="late-badge">${emp.attendance.lateByMinutes}min</span>` : 
                                        '<span class="on-time-badge">On Time</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    resultDiv.style.display = 'block';
    
    // Show export button
    const exportBtn = document.getElementById('export-report-btn');
    if (exportBtn) {
        exportBtn.style.display = 'inline-block';
    }
}

// Global functions for attendance actions
function viewAttendanceDetails(id) {
    showToast('View attendance details functionality coming soon!', 'info');
}

function editAttendanceRecord(id) {
    openManualAttendanceModal(id);
}

async function deleteAttendanceRecord(id) {
    if (!confirm('Are you sure you want to delete this attendance record?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/attendance/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Attendance record deleted successfully', 'success');
            loadAttendanceRecords(); // Reload the attendance list
            loadTodayAttendanceSummary(); // Refresh summary
        } else {
            showToast(result.message || 'Failed to delete attendance record', 'error');
        }
    } catch (error) {
        console.error('Error deleting attendance record:', error);
        showToast('Error deleting attendance record', 'error');
    }
}

console.log('Attendance management functions loaded successfully');

// ===== LEAVE MANAGEMENT FUNCTIONS =====

// Load leave management page data
async function loadLeavesData() {
    try {
        // Load employees for filters
        await loadEmployeesForLeaves();
        
        // Load leave summary stats
        await loadLeaveSummaryStats();
        
        // Load leave records
        await loadLeaveRecords();
        
        console.log('Leave management data loaded successfully');
    } catch (error) {
        console.error('Error loading leave data:', error);
        showToast('Error loading leave data', 'error');
    }
}

// Load employees for leave filters and forms
async function loadEmployeesForLeaves() {
    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const employees = data.employees || [];
            
            // Populate employee dropdowns
            const selects = [
                'leave-employee',
                'apply-leave-employee'
            ];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">All Employees</option>';
                    employees.forEach(employee => {
                        const option = document.createElement('option');
                        option.value = employee._id;
                        option.textContent = `${employee.employeeId} - ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
                        select.appendChild(option);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error loading employees for leaves:', error);
    }
}

// Load leave summary statistics
async function loadLeaveSummaryStats() {
    try {
        const year = new Date().getFullYear();
        const response = await fetch(`/api/leaves/reports/summary?year=${year}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const summary = data.summary;
            
            // Update summary cards
            document.getElementById('total-leaves').textContent = summary.totals?.totalApplications || 0;
            document.getElementById('approved-leaves').textContent = summary.byStatus?.approved?.count || 0;
            document.getElementById('pending-leaves').textContent = summary.byStatus?.pending?.count || 0;
            document.getElementById('rejected-leaves').textContent = summary.byStatus?.rejected?.count || 0;
        }
    } catch (error) {
        console.error('Error loading leave summary stats:', error);
    }
}

// Load leave records
async function loadLeaveRecords() {
    try {
        const params = new URLSearchParams();
        
        // Get filter values
        const employeeId = document.getElementById('leave-employee')?.value;
        const leaveType = document.getElementById('leave-type-filter')?.value;
        const status = document.getElementById('leave-status-filter')?.value;
        const year = document.getElementById('leave-year')?.value;
        
        if (employeeId) params.append('employeeId', employeeId);
        if (leaveType) params.append('leaveType', leaveType);
        if (status) params.append('status', status);
        if (year) params.append('year', year);
        
        const url = `/api/leaves${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayLeaveRecords(data.leaves || []);
            
            // Update count
            const countElement = document.getElementById('leave-count');
            if (countElement) {
                countElement.textContent = `Showing ${data.leaves.length} records`;
            }
        } else {
            showToast('Failed to load leave records', 'error');
        }
    } catch (error) {
        console.error('Error loading leave records:', error);
        showToast('Error loading leave records', 'error');
    }
}

// Display leave records in table
function displayLeaveRecords(records) {
    const tbody = document.querySelector('#leaves-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--gray-500);">No leave records found</td></tr>';
        return;
    }
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // Format dates
        const startDate = new Date(record.startDate).toLocaleDateString('en-IN');
        const endDate = new Date(record.endDate).toLocaleDateString('en-IN');
        const appliedDate = new Date(record.appliedDate).toLocaleDateString('en-IN');
        
        // Employee name
        const employeeName = record.employee ? 
            `${record.employee.personalInfo.firstName} ${record.employee.personalInfo.lastName}` : 
            'Unknown';
        
        // Leave type display
        const leaveTypeDisplay = record.leaveType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        row.innerHTML = `
            <td><strong>${record.leaveId || 'N/A'}</strong></td>
            <td>
                <div class="employee-info">
                    <div class="employee-name">${employeeName}</div>
                    <div class="employee-id">${record.employee?.employeeId || 'N/A'}</div>
                </div>
            </td>
            <td>
                <span class="leave-type-badge">${leaveTypeDisplay}</span>
                ${record.isEmergency ? '<i class="fas fa-exclamation-triangle" title="Emergency Leave" style="color: #f59e0b;"></i>' : ''}
                ${record.isHalfDay ? '<i class="fas fa-clock" title="Half Day" style="color: #6b7280;"></i>' : ''}
            </td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td>${record.totalDays} day${record.totalDays !== 1 ? 's' : ''}</td>
            <td>
                <span class="status-badge status-${record.status}">
                    ${record.status.replace('-', ' ')}
                </span>
            </td>
            <td>${appliedDate}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-view" onclick="viewLeaveDetails('${record._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${canApproveLeave(record) ? `
                        <button class="btn-sm btn-approve" onclick="approveLeave('${record._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-sm btn-reject" onclick="rejectLeave('${record._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    ${canEditLeave(record) ? `
                        <button class="btn-sm btn-edit" onclick="editLeave('${record._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    ${canCancelLeave(record) ? `
                        <button class="btn-sm btn-cancel" onclick="cancelLeave('${record._id}')">
                            <i class="fas fa-ban"></i>
                        </button>
                    ` : ''}
                    ${currentUser && ['admin'].includes(currentUser.role) ? `
                        <button class="btn-sm btn-delete" onclick="deleteLeave('${record._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Check if user can approve leave
function canApproveLeave(leave) {
    if (!currentUser || !['admin', 'hr', 'manager'].includes(currentUser.role)) {
        return false;
    }
    
    return ['pending', 'submitted', 'under-review'].includes(leave.status);
}

// Check if user can edit leave
function canEditLeave(leave) {
    if (!currentUser) return false;
    
    // Admin and HR can edit any leave
    if (['admin', 'hr'].includes(currentUser.role)) {
        return true;
    }
    
    // Users can edit their own pending leaves
    return leave.appliedBy === currentUser.id && ['pending', 'submitted'].includes(leave.status);
}

// Check if user can cancel leave
function canCancelLeave(leave) {
    if (!currentUser) return false;
    
    // Admin and HR can cancel any leave
    if (['admin', 'hr'].includes(currentUser.role)) {
        return ['pending', 'submitted', 'under-review', 'approved'].includes(leave.status);
    }
    
    // Users can cancel their own leaves
    return leave.appliedBy === currentUser.id && ['pending', 'submitted', 'under-review'].includes(leave.status);
}

// Setup leave page handlers
function setupLeavePageHandlers() {
    // Apply leave button
    const applyBtn = document.getElementById('apply-leave-btn');
    if (applyBtn && !applyBtn.hasAttribute('data-listener-attached')) {
        applyBtn.addEventListener('click', openApplyLeaveModal);
        applyBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Leave balance button
    const balanceBtn = document.getElementById('leave-balance-btn');
    if (balanceBtn && !balanceBtn.hasAttribute('data-listener-attached')) {
        balanceBtn.addEventListener('click', openLeaveBalanceModal);
        balanceBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Leave calendar button
    const calendarBtn = document.getElementById('leave-calendar-btn');
    if (calendarBtn && !calendarBtn.hasAttribute('data-listener-attached')) {
        calendarBtn.addEventListener('click', openLeaveCalendarModal);
        calendarBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Pending approvals button
    const approvalsBtn = document.getElementById('pending-approvals-btn');
    if (approvalsBtn && !approvalsBtn.hasAttribute('data-listener-attached')) {
        approvalsBtn.addEventListener('click', openPendingApprovalsModal);
        approvalsBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Filter handlers
    const filters = ['leave-employee', 'leave-type-filter', 'leave-status-filter', 'leave-year'];
    filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter && !filter.hasAttribute('data-listener-attached')) {
            filter.addEventListener('change', loadLeaveRecords);
            filter.setAttribute('data-listener-attached', 'true');
        }
    });
}

// Open apply leave modal
function openApplyLeaveModal() {
    showToast('Apply Leave modal functionality coming soon!', 'info');
}

// Open leave balance modal
function openLeaveBalanceModal() {
    showToast('Leave Balance modal functionality coming soon!', 'info');
}

// Open leave calendar modal
function openLeaveCalendarModal() {
    showToast('Leave Calendar modal functionality coming soon!', 'info');
}

// Open pending approvals modal
function openPendingApprovalsModal() {
    showToast('Pending Approvals modal functionality coming soon!', 'info');
}

// Global functions for leave actions
function viewLeaveDetails(id) {
    showToast('View leave details functionality coming soon!', 'info');
}

async function approveLeave(id) {
    const comments = prompt('Enter approval comments (optional):');
    if (comments === null) return; // User cancelled
    
    try {
        const response = await fetch(`/api/leaves/${id}/approve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ comments })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Leave approved successfully', 'success');
            loadLeaveRecords(); // Reload the leave list
            loadLeaveSummaryStats(); // Refresh summary
        } else {
            showToast(result.message || 'Failed to approve leave', 'error');
        }
    } catch (error) {
        console.error('Error approving leave:', error);
        showToast('Error approving leave', 'error');
    }
}

async function rejectLeave(id) {
    const comments = prompt('Enter rejection reason (required):');
    if (!comments || comments.trim() === '') {
        showToast('Rejection reason is required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/leaves/${id}/reject`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ comments })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Leave rejected successfully', 'success');
            loadLeaveRecords(); // Reload the leave list
            loadLeaveSummaryStats(); // Refresh summary
        } else {
            showToast(result.message || 'Failed to reject leave', 'error');
        }
    } catch (error) {
        console.error('Error rejecting leave:', error);
        showToast('Error rejecting leave', 'error');
    }
}

function editLeave(id) {
    showToast('Edit leave functionality coming soon!', 'info');
}

async function cancelLeave(id) {
    const reason = prompt('Enter cancellation reason (required):');
    if (!reason || reason.trim() === '') {
        showToast('Cancellation reason is required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/leaves/${id}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ reason })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Leave cancelled successfully', 'success');
            loadLeaveRecords(); // Reload the leave list
            loadLeaveSummaryStats(); // Refresh summary
        } else {
            showToast(result.message || 'Failed to cancel leave', 'error');
        }
    } catch (error) {
        console.error('Error cancelling leave:', error);
        showToast('Error cancelling leave', 'error');
    }
}

async function deleteLeave(id) {
    if (!confirm('Are you sure you want to delete this leave record? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/leaves/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Leave record deleted successfully', 'success');
            loadLeaveRecords(); // Reload the leave list
            loadLeaveSummaryStats(); // Refresh summary
        } else {
            showToast(result.message || 'Failed to delete leave record', 'error');
        }
    } catch (error) {
        console.error('Error deleting leave:', error);
        showToast('Error deleting leave record', 'error');
    }
}

console.log('Leave management functions loaded successfully');

// ===== PAYROLL MANAGEMENT FUNCTIONS =====

// Load payroll management page data
async function loadPayrollData() {
    try {
        // Load employees for filters
        await loadEmployeesForPayroll();
        
        // Load payroll summary stats
        await loadPayrollSummaryStats();
        
        // Load payroll records
        await loadPayrollRecords();
        
        console.log('Payroll management data loaded successfully');
    } catch (error) {
        console.error('Error loading payroll data:', error);
        showToast('Error loading payroll data', 'error');
    }
}

// Load employees for payroll filters and forms
async function loadEmployeesForPayroll() {
    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const employees = data.employees || [];
            
            // Populate employee dropdowns
            const selects = [
                'payroll-employee',
                'bulk-payroll-employees',
                'tax-employee',
                'disbursement-employee'
            ];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">All Employees</option>';
                    employees.forEach(employee => {
                        const option = document.createElement('option');
                        option.value = employee._id;
                        option.textContent = `${employee.employeeId} - ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
                        select.appendChild(option);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error loading employees for payroll:', error);
    }
}

// Load payroll summary statistics
async function loadPayrollSummaryStats() {
    try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const response = await fetch(`/api/payroll/reports/summary?year=${year}&month=${month}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const summary = data.summary;
            
            // Update summary cards
            document.getElementById('total-payrolls').textContent = summary.totalEmployees || 0;
            document.getElementById('processed-payrolls').textContent = summary.paidCount || 0;
            document.getElementById('pending-payrolls').textContent = summary.pendingCount || 0;
            document.getElementById('total-payroll-amount').textContent = 
                '₹' + (summary.totalNetPay || 0).toLocaleString('en-IN');
        }
    } catch (error) {
        console.error('Error loading payroll summary stats:', error);
    }
}

// Load payroll records
async function loadPayrollRecords() {
    try {
        const params = new URLSearchParams();
        
        // Get filter values
        const employeeId = document.getElementById('payroll-employee')?.value;
        const status = document.getElementById('payroll-status-filter')?.value;
        const month = document.getElementById('payroll-month')?.value;
        const year = document.getElementById('payroll-year')?.value || 2026;
        const department = document.getElementById('payroll-department')?.value;
        
        if (employeeId) params.append('employeeId', employeeId);
        if (status) params.append('status', status);
        if (month) params.append('month', month);
        if (year) params.append('year', year);
        if (department) params.append('department', department);
        
        const url = `/api/payroll${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayPayrollRecords(data.payrolls || []);
            
            // Update count
            const countElement = document.getElementById('payroll-count');
            if (countElement) {
                countElement.textContent = `Showing ${data.payrolls.length} records`;
            }
        } else {
            showToast('Failed to load payroll records', 'error');
        }
    } catch (error) {
        console.error('Error loading payroll records:', error);
        showToast('Error loading payroll records', 'error');
    }
}

// Display payroll records in table
function displayPayrollRecords(records) {
    const tbody = document.querySelector('#payroll-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--gray-500);">No payroll records found</td></tr>';
        return;
    }
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // Employee name
        const employeeName = record.employee ? 
            `${record.employee.personalInfo.firstName} ${record.employee.personalInfo.lastName}` : 
            'Unknown';
        
        // Format pay period
        const payPeriod = `${record.payPeriod.month}/${record.payPeriod.year}`;
        
        // Format amounts
        const grossPay = '₹' + (record.grossPay || 0).toLocaleString('en-IN');
        const totalDeductions = '₹' + (record.totalDeductions || 0).toLocaleString('en-IN');
        const netPay = '₹' + (record.netPay || 0).toLocaleString('en-IN');
        
        // Status badge
        const statusClass = {
            'draft': 'status-draft',
            'calculated': 'status-pending',
            'approved': 'status-approved',
            'processed': 'status-processed',
            'paid': 'status-success',
            'cancelled': 'status-cancelled'
        }[record.status] || 'status-draft';
        
        row.innerHTML = `
            <td><strong>${record.payrollId || 'N/A'}</strong></td>
            <td>
                <div class="employee-info">
                    <div class="employee-name">${employeeName}</div>
                    <div class="employee-id">${record.employee?.employeeId || 'N/A'}</div>
                </div>
            </td>
            <td>${record.employee?.employment?.department || 'N/A'}</td>
            <td>${payPeriod}</td>
            <td>${record.payPeriod.actualWorkingDays || 0}/${record.payPeriod.workingDays || 0}</td>
            <td>${grossPay}</td>
            <td>${totalDeductions}</td>
            <td><strong>${netPay}</strong></td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${record.status.replace('-', ' ')}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-view" onclick="viewPayrollDetails('${record._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${record.status === 'calculated' && ['admin', 'hr', 'finance'].includes(currentUser?.role) ? `
                        <button class="btn-sm btn-approve" onclick="approvePayroll('${record._id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    ${record.status === 'approved' && ['admin', 'finance'].includes(currentUser?.role) ? `
                        <button class="btn-sm btn-process" onclick="processPayroll('${record._id}')" title="Process Payment">
                            <i class="fas fa-credit-card"></i>
                        </button>
                    ` : ''}
                    ${['approved', 'processed', 'paid'].includes(record.status) ? `
                        <button class="btn-sm btn-download" onclick="downloadPayslip('${record._id}')" title="Download Payslip">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    ${['admin', 'hr'].includes(currentUser?.role) && ['approved', 'processed', 'paid'].includes(record.status) ? `
                        <button class="btn-sm btn-email" onclick="emailPayslip('${record._id}')" title="Email Payslip">
                            <i class="fas fa-envelope"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Setup payroll page handlers
function setupPayrollPageHandlers() {
    // Bulk process payroll button
    const bulkProcessBtn = document.getElementById('bulk-process-payroll-btn');
    if (bulkProcessBtn && !bulkProcessBtn.hasAttribute('data-listener-attached')) {
        bulkProcessBtn.addEventListener('click', openBulkProcessModal);
        bulkProcessBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Generate compliance reports button
    const complianceBtn = document.getElementById('compliance-reports-btn');
    if (complianceBtn && !complianceBtn.hasAttribute('data-listener-attached')) {
        complianceBtn.addEventListener('click', openComplianceReportsModal);
        complianceBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Tax management button
    const taxMgmtBtn = document.getElementById('tax-management-btn');
    if (taxMgmtBtn && !taxMgmtBtn.hasAttribute('data-listener-attached')) {
        taxMgmtBtn.addEventListener('click', openTaxManagementModal);
        taxMgmtBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Salary disbursement button
    const disbursementBtn = document.getElementById('salary-disbursement-btn');
    if (disbursementBtn && !disbursementBtn.hasAttribute('data-listener-attached')) {
        disbursementBtn.addEventListener('click', openSalaryDisbursementModal);
        disbursementBtn.setAttribute('data-listener-attached', 'true');
    }
    
    // Filter handlers
    const filters = ['payroll-employee', 'payroll-status-filter', 'payroll-month', 'payroll-year', 'payroll-department'];
    filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter && !filter.hasAttribute('data-listener-attached')) {
            filter.addEventListener('change', loadPayrollRecords);
            filter.setAttribute('data-listener-attached', 'true');
        }
    });
    
    // Bulk process form
    const bulkForm = document.getElementById('bulk-process-form');
    if (bulkForm && !bulkForm.hasAttribute('data-listener-attached')) {
        bulkForm.addEventListener('submit', handleBulkProcessSubmit);
        bulkForm.setAttribute('data-listener-attached', 'true');
    }
    
    // Compliance report form
    const complianceForm = document.getElementById('compliance-report-form');
    if (complianceForm && !complianceForm.hasAttribute('data-listener-attached')) {
        complianceForm.addEventListener('submit', handleComplianceReportSubmit);
        complianceForm.setAttribute('data-listener-attached', 'true');
    }
    
    // Tax management form
    const taxForm = document.getElementById('tax-management-form');
    if (taxForm && !taxForm.hasAttribute('data-listener-attached')) {
        taxForm.addEventListener('submit', handleTaxManagementSubmit);
        taxForm.setAttribute('data-listener-attached', 'true');
    }
    
    // Disbursement form
    const disbursementForm = document.getElementById('disbursement-form');
    if (disbursementForm && !disbursementForm.hasAttribute('data-listener-attached')) {
        disbursementForm.addEventListener('submit', handleDisbursementSubmit);
        disbursementForm.setAttribute('data-listener-attached', 'true');
    }
}

// Open bulk process payroll modal
function openBulkProcessModal() {
    const modal = document.getElementById('bulk-process-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Set default dates (current month)
        const now = new Date();
        document.getElementById('bulk-month').value = now.getMonth() + 1;
        document.getElementById('bulk-year').value = now.getFullYear();
        
        // Load employees for selection
        loadEmployeesForBulkProcess();
    }
}

// Close bulk process modal
function closeBulkProcessModal() {
    const modal = document.getElementById('bulk-process-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load employees for bulk process
async function loadEmployeesForBulkProcess() {
    try {
        const response = await fetch('/api/employees?status=active', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const employees = data.employees || [];
            
            const container = document.getElementById('bulk-employees-list');
            if (container) {
                container.innerHTML = '';
                
                employees.forEach(employee => {
                    const div = document.createElement('div');
                    div.className = 'employee-checkbox';
                    div.innerHTML = `
                        <label>
                            <input type="checkbox" name="employeeIds" value="${employee._id}" checked>
                            <span class="employee-name">${employee.personalInfo.firstName} ${employee.personalInfo.lastName}</span>
                            <span class="employee-id">(${employee.employeeId})</span>
                            <span class="employee-dept">${employee.employment.department}</span>
                        </label>
                    `;
                    container.appendChild(div);
                });
            }
        }
    } catch (error) {
        console.error('Error loading employees for bulk process:', error);
    }
}

// Handle bulk process form submission
async function handleBulkProcessSubmit(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        const formData = new FormData(e.target);
        const employeeIds = formData.getAll('employeeIds');
        const month = parseInt(formData.get('month'));
        const year = parseInt(formData.get('year'));
        const includeReimbursements = formData.get('includeReimbursements') === 'on';
        
        if (employeeIds.length === 0) {
            showToast('Please select at least one employee', 'error');
            return;
        }
        
        const response = await fetch('/api/payroll/process-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                month,
                year,
                employeeIds,
                includeReimbursements
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`${result.message}. Processed: ${result.processedCount}, Errors: ${result.errorCount}`, 'success');
            if (result.errors.length > 0) {
                console.log('Processing errors:', result.errors);
            }
            closeBulkProcessModal();
            loadPayrollRecords(); // Reload the payroll list
            loadPayrollSummaryStats(); // Refresh summary
        } else {
            if (result.errors && Array.isArray(result.errors)) {
                const errorMessages = result.errors.map(err => err.msg || err.message).join(', ');
                showToast(`Error: ${errorMessages}`, 'error');
            } else {
                showToast(result.message || 'Failed to process payroll', 'error');
            }
        }
    } catch (error) {
        console.error('Error processing bulk payroll:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// Open compliance reports modal
function openComplianceReportsModal() {
    const modal = document.getElementById('compliance-reports-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Set default dates (current month)
        const now = new Date();
        document.getElementById('compliance-month').value = now.getMonth() + 1;
        document.getElementById('compliance-year').value = now.getFullYear();
    }
}

// Close compliance reports modal
function closeComplianceReportsModal() {
    const modal = document.getElementById('compliance-reports-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Handle compliance report form submission
async function handleComplianceReportSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const month = formData.get('month');
    const year = formData.get('year');
    const type = formData.get('type');
    
    if (!month || !year || !type) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/payroll/compliance/challans?month=${month}&year=${year}&type=${type}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayComplianceReport(data);
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to generate compliance report', 'error');
        }
    } catch (error) {
        console.error('Error generating compliance report:', error);
        showToast('Error generating compliance report', 'error');
    }
}

// Display compliance report
function displayComplianceReport(data) {
    const resultDiv = document.getElementById('compliance-report-result');
    if (!resultDiv) return;
    
    const typeNames = {
        'pf': 'Provident Fund (PF)',
        'esi': 'Employee State Insurance (ESI)',
        'pt': 'Professional Tax (PT)'
    };
    
    let content = `
        <div class="compliance-report-card">
            <div class="report-header">
                <h4>${typeNames[data.challanType.toLowerCase()] || data.challanType} Challan</h4>
                <p>Period: ${data.period}</p>
                <p>Total Employees: ${data.totalEmployees}</p>
            </div>
            
            <div class="report-summary">
    `;
    
    if (data.challanType === 'PF') {
        content += `
            <div class="summary-stats">
                <div class="summary-stat">
                    <span class="stat-label">Employee Contribution:</span>
                    <span class="stat-value">₹${data.totalEmployeeContribution.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Employer Contribution:</span>
                    <span class="stat-value">₹${data.totalEmployerContribution.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Pension Fund:</span>
                    <span class="stat-value">₹${data.totalPensionFund.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Admin Charges:</span>
                    <span class="stat-value">₹${data.totalAdminCharges.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-stat total">
                    <span class="stat-label">Grand Total:</span>
                    <span class="stat-value">₹${data.grandTotal.toLocaleString('en-IN')}</span>
                </div>
            </div>
        `;
    } else if (data.challanType === 'ESI') {
        content += `
            <div class="summary-stats">
                <div class="summary-stat">
                    <span class="stat-label">Employee Contribution:</span>
                    <span class="stat-value">₹${data.totalEmployeeContribution.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Employer Contribution:</span>
                    <span class="stat-value">₹${data.totalEmployerContribution.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-stat total">
                    <span class="stat-label">Grand Total:</span>
                    <span class="stat-value">₹${data.grandTotal.toLocaleString('en-IN')}</span>
                </div>
            </div>
        `;
    } else if (data.challanType === 'Professional Tax') {
        content += `
            <div class="summary-stats">
                <div class="summary-stat">
                    <span class="stat-label">State:</span>
                    <span class="stat-value">${data.state}</span>
                </div>
                <div class="summary-stat total">
                    <span class="stat-label">Total Professional Tax:</span>
                    <span class="stat-value">₹${data.totalProfessionalTax.toLocaleString('en-IN')}</span>
                </div>
            </div>
        `;
    }
    
    content += `
            </div>
            
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
    `;
    
    if (data.challanType === 'PF') {
        content += `
                            <th>PF Number</th>
                            <th>Basic Salary</th>
                            <th>Employee Contribution</th>
                            <th>Employer Contribution</th>
        `;
    } else if (data.challanType === 'ESI') {
        content += `
                            <th>ESI Number</th>
                            <th>Gross Salary</th>
                            <th>Employee Contribution</th>
                            <th>Employer Contribution</th>
        `;
    } else if (data.challanType === 'Professional Tax') {
        content += `
                            <th>Gross Salary</th>
                            <th>Professional Tax</th>
        `;
    }
    
    content += `
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    data.employeeDetails.forEach(emp => {
        content += `
            <tr>
                <td>${emp.employeeId}</td>
                <td>${emp.name}</td>
        `;
        
        if (data.challanType === 'PF') {
            content += `
                <td>${emp.pfNumber || 'N/A'}</td>
                <td>₹${emp.basicSalary.toLocaleString('en-IN')}</td>
                <td>₹${emp.employeeContribution.toLocaleString('en-IN')}</td>
                <td>₹${emp.employerContribution.toLocaleString('en-IN')}</td>
            `;
        } else if (data.challanType === 'ESI') {
            content += `
                <td>${emp.esiNumber || 'N/A'}</td>
                <td>₹${emp.grossSalary.toLocaleString('en-IN')}</td>
                <td>₹${emp.employeeContribution.toLocaleString('en-IN')}</td>
                <td>₹${emp.employerContribution.toLocaleString('en-IN')}</td>
            `;
        } else if (data.challanType === 'Professional Tax') {
            content += `
                <td>₹${emp.grossSalary.toLocaleString('en-IN')}</td>
                <td>₹${emp.professionalTax.toLocaleString('en-IN')}</td>
            `;
        }
        
        content += `</tr>`;
    });
    
    content += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = content;
    resultDiv.style.display = 'block';
}

// Open tax management modal
function openTaxManagementModal() {
    const modal = document.getElementById('tax-management-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Set default financial year
        const currentYear = new Date().getFullYear();
        const financialYear = new Date().getMonth() >= 3 ? currentYear : currentYear - 1;
        document.getElementById('tax-financial-year').value = financialYear;
        
        // Load tax records
        loadTaxRecords();
    }
}

// Close tax management modal
function closeTaxManagementModal() {
    const modal = document.getElementById('tax-management-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load tax records
async function loadTaxRecords() {
    try {
        const financialYear = document.getElementById('tax-financial-year')?.value;
        const employeeId = document.getElementById('tax-employee')?.value;
        
        const params = new URLSearchParams();
        if (financialYear) params.append('financialYear', financialYear);
        if (employeeId) params.append('employeeId', employeeId);
        
        const response = await fetch(`/api/tax-management?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayTaxRecords(data.taxRecords || []);
        } else {
            showToast('Failed to load tax records', 'error');
        }
    } catch (error) {
        console.error('Error loading tax records:', error);
        showToast('Error loading tax records', 'error');
    }
}

// Display tax records
function displayTaxRecords(records) {
    const container = document.getElementById('tax-records-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (records.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">No tax records found</p>';
        return;
    }
    
    records.forEach(record => {
        const div = document.createElement('div');
        div.className = 'tax-record-card';
        
        const employeeName = record.employeeId ? 
            `${record.employeeId.personalInfo.firstName} ${record.employeeId.personalInfo.lastName}` : 
            'Unknown';
        
        const statusClass = {
            'draft': 'status-draft',
            'submitted': 'status-pending',
            'under-review': 'status-warning',
            'approved': 'status-success',
            'completed': 'status-success'
        }[record.status] || 'status-draft';
        
        div.innerHTML = `
            <div class="tax-record-header">
                <h5>${employeeName} (${record.employeeId?.employeeId || 'N/A'})</h5>
                <span class="status-badge ${statusClass}">${record.status.replace('-', ' ')}</span>
            </div>
            <div class="tax-record-details">
                <div class="tax-detail">
                    <span class="label">Financial Year:</span>
                    <span class="value">${record.financialYear.startYear}-${record.financialYear.endYear}</span>
                </div>
                <div class="tax-detail">
                    <span class="label">Tax Regime:</span>
                    <span class="value">${record.taxRegime.toUpperCase()}</span>
                </div>
                <div class="tax-detail">
                    <span class="label">Annual Salary:</span>
                    <span class="value">₹${record.annualSalary.grossAnnualSalary.toLocaleString('en-IN')}</span>
                </div>
                <div class="tax-detail">
                    <span class="label">Tax Liability:</span>
                    <span class="value">₹${record.taxCalculation.totalTaxLiability.toLocaleString('en-IN')}</span>
                </div>
                <div class="tax-detail">
                    <span class="label">Monthly TDS:</span>
                    <span class="value">₹${record.taxCalculation.monthlyTDS.toLocaleString('en-IN')}</span>
                </div>
            </div>
            <div class="tax-record-actions">
                <button class="btn-sm btn-view" onclick="viewTaxDetails('${record._id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${record.form16.generated ? `
                    <button class="btn-sm btn-download" onclick="downloadForm16('${record._id}')">
                        <i class="fas fa-download"></i> Form 16
                    </button>
                ` : ''}
                ${['admin', 'hr'].includes(currentUser?.role) && record.status === 'submitted' ? `
                    <button class="btn-sm btn-approve" onclick="approveTaxDeclaration('${record._id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Open salary disbursement modal
function openSalaryDisbursementModal() {
    const modal = document.getElementById('salary-disbursement-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Load disbursement records
        loadDisbursementRecords();
    }
}

// Close salary disbursement modal
function closeSalaryDisbursementModal() {
    const modal = document.getElementById('salary-disbursement-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load disbursement records
async function loadDisbursementRecords() {
    try {
        const params = new URLSearchParams();
        
        // Get filter values
        const employeeId = document.getElementById('disbursement-employee')?.value;
        const status = document.getElementById('disbursement-status')?.value;
        const month = document.getElementById('disbursement-month')?.value;
        const year = document.getElementById('disbursement-year')?.value || new Date().getFullYear();
        
        if (employeeId) params.append('employeeId', employeeId);
        if (status) params.append('status', status);
        if (month) params.append('month', month);
        if (year) params.append('year', year);
        
        const response = await fetch(`/api/salary-disbursement?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayDisbursementRecords(data.disbursements || []);
        } else {
            showToast('Failed to load disbursement records', 'error');
        }
    } catch (error) {
        console.error('Error loading disbursement records:', error);
        showToast('Error loading disbursement records', 'error');
    }
}

// Display disbursement records
function displayDisbursementRecords(records) {
    const container = document.getElementById('disbursement-records-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (records.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">No disbursement records found</p>';
        return;
    }
    
    records.forEach(record => {
        const div = document.createElement('div');
        div.className = 'disbursement-record-card';
        
        const employeeName = record.employeeId ? 
            `${record.employeeId.personalInfo.firstName} ${record.employeeId.personalInfo.lastName}` : 
            'Unknown';
        
        const statusClass = {
            'pending': 'status-pending',
            'processing': 'status-warning',
            'queued': 'status-warning',
            'success': 'status-success',
            'failed': 'status-error',
            'cancelled': 'status-cancelled'
        }[record.transaction.status] || 'status-pending';
        
        const paymentDate = record.transaction.transactionDate ? 
            new Date(record.transaction.transactionDate).toLocaleDateString('en-IN') : 'N/A';
        
        div.innerHTML = `
            <div class="disbursement-record-header">
                <h5>${employeeName} (${record.employeeId?.employeeId || 'N/A'})</h5>
                <span class="status-badge ${statusClass}">${record.transaction.status}</span>
            </div>
            <div class="disbursement-record-details">
                <div class="disbursement-detail">
                    <span class="label">Disbursement ID:</span>
                    <span class="value">${record.disbursementId}</span>
                </div>
                <div class="disbursement-detail">
                    <span class="label">Batch ID:</span>
                    <span class="value">${record.batchId}</span>
                </div>
                <div class="disbursement-detail">
                    <span class="label">Net Amount:</span>
                    <span class="value">₹${record.paymentDetails.netAmount.toLocaleString('en-IN')}</span>
                </div>
                <div class="disbursement-detail">
                    <span class="label">Payment Method:</span>
                    <span class="value">${record.paymentDetails.paymentMethod.toUpperCase()}</span>
                </div>
                <div class="disbursement-detail">
                    <span class="label">Transaction ID:</span>
                    <span class="value">${record.transaction.transactionId || 'N/A'}</span>
                </div>
                <div class="disbursement-detail">
                    <span class="label">UTR Number:</span>
                    <span class="value">${record.transaction.utrNumber || 'N/A'}</span>
                </div>
                <div class="disbursement-detail">
                    <span class="label">Payment Date:</span>
                    <span class="value">${paymentDate}</span>
                </div>
            </div>
            <div class="disbursement-record-actions">
                <button class="btn-sm btn-view" onclick="viewDisbursementDetails('${record._id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${record.transaction.status === 'pending' && ['admin', 'finance'].includes(currentUser?.role) ? `
                    <button class="btn-sm btn-process" onclick="initiateDisbursement('${record._id}')">
                        <i class="fas fa-play"></i> Initiate
                    </button>
                ` : ''}
                ${record.transaction.status === 'failed' && ['admin', 'finance'].includes(currentUser?.role) ? `
                    <button class="btn-sm btn-retry" onclick="retryDisbursement('${record._id}')">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Global functions for payroll actions
function viewPayrollDetails(id) {
    showToast('View payroll details functionality coming soon!', 'info');
}

async function approvePayroll(id) {
    const comments = prompt('Enter approval comments (optional):');
    
    try {
        const response = await fetch(`/api/payroll/${id}/approve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ comments: comments || '' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Payroll approved successfully', 'success');
            loadPayrollRecords(); // Reload the payroll list
        } else {
            showToast(result.message || 'Failed to approve payroll', 'error');
        }
    } catch (error) {
        console.error('Error approving payroll:', error);
        showToast('Error approving payroll', 'error');
    }
}

async function processPayroll(id) {
    if (!confirm('Are you sure you want to process this payroll for payment?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/payroll/disburse-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                payrollIds: [id],
                paymentMethod: 'neft',
                paymentGateway: 'manual'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Payroll processed for payment successfully', 'success');
            loadPayrollRecords(); // Reload the payroll list
        } else {
            showToast(result.message || 'Failed to process payroll', 'error');
        }
    } catch (error) {
        console.error('Error processing payroll:', error);
        showToast('Error processing payroll', 'error');
    }
}

async function downloadPayslip(id) {
    try {
        const response = await fetch(`/api/payroll/${id}/payslip`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `payslip-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Payslip downloaded successfully', 'success');
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to download payslip', 'error');
        }
    } catch (error) {
        console.error('Error downloading payslip:', error);
        showToast('Error downloading payslip', 'error');
    }
}

async function emailPayslip(id) {
    try {
        const response = await fetch(`/api/payroll/${id}/email-payslip`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Payslip emailed successfully', 'success');
        } else {
            showToast(result.message || 'Failed to email payslip', 'error');
        }
    } catch (error) {
        console.error('Error emailing payslip:', error);
        showToast('Error emailing payslip', 'error');
    }
}

// Tax management functions
function viewTaxDetails(id) {
    showToast('View tax details functionality coming soon!', 'info');
}

async function downloadForm16(id) {
    try {
        const response = await fetch(`/api/tax-management/${id}/form16`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `form16-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Form 16 downloaded successfully', 'success');
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to download Form 16', 'error');
        }
    } catch (error) {
        console.error('Error downloading Form 16:', error);
        showToast('Error downloading Form 16', 'error');
    }
}

async function approveTaxDeclaration(id) {
    const comments = prompt('Enter approval comments (optional):');
    
    try {
        const response = await fetch(`/api/tax-management/${id}/approve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ comments: comments || '' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Tax declaration approved successfully', 'success');
            loadTaxRecords(); // Reload the tax records
        } else {
            showToast(result.message || 'Failed to approve tax declaration', 'error');
        }
    } catch (error) {
        console.error('Error approving tax declaration:', error);
        showToast('Error approving tax declaration', 'error');
    }
}

// Disbursement functions
function viewDisbursementDetails(id) {
    showToast('View disbursement details functionality coming soon!', 'info');
}

async function initiateDisbursement(id) {
    if (!confirm('Are you sure you want to initiate this payment?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/salary-disbursement/${id}/initiate`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Payment initiated successfully', 'success');
            loadDisbursementRecords(); // Reload the disbursement records
        } else {
            showToast(result.message || 'Failed to initiate payment', 'error');
        }
    } catch (error) {
        console.error('Error initiating disbursement:', error);
        showToast('Error initiating disbursement', 'error');
    }
}

async function retryDisbursement(id) {
    if (!confirm('Are you sure you want to retry this failed payment?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/salary-disbursement/${id}/retry`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Payment retry initiated successfully', 'success');
            loadDisbursementRecords(); // Reload the disbursement records
        } else {
            showToast(result.message || 'Failed to retry payment', 'error');
        }
    } catch (error) {
        console.error('Error retrying disbursement:', error);
        showToast('Error retrying disbursement', 'error');
    }
}

console.log('Payroll management functions loaded successfully');