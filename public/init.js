// Clean initialization script for HR Pro
console.log('HR Pro initialization script loaded');

// Global variables
let currentUser = null;
let currentPage = 'dashboard';

// Initialize when DOM is ready
function initWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM is already ready
        initializeApp();
    }
}

// Call initialization
initWhenReady();

function initializeApp() {
    console.log('Starting app initialization');
    console.log('Document ready state:', document.readyState);
    
    // Clear any existing data
    localStorage.clear();
    
    // Get required elements
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    
    // Verify elements exist
    if (!loadingScreen) {
        console.error('Loading screen not found');
        return;
    }
    
    if (!loginScreen) {
        console.error('Login screen not found');
        return;
    }
    
    if (!app) {
        console.error('App container not found');
        return;
    }
    
    console.log('All required elements found');
    
    // Ensure proper initial state
    loadingScreen.style.display = 'flex';
    loginScreen.style.display = 'none';
    app.style.display = 'none';
    
    // Show login screen after 2 seconds
    setTimeout(() => {
        console.log('Switching to login screen');
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
        app.style.display = 'none';
        
        // Setup event listeners after showing login screen
        setupEventListeners();
    }, 2000);
}

function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('Login form listener attached');
    } else {
        console.error('Login form not found');
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log('Register form listener attached');
    }
    
    // Toggle links
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    
    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            showRegisterForm();
        });
    }
    
    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLoginForm();
        });
    }
    
    // Setup navigation
    setupNavigation();
}

function setupNavigation() {
    // Sidebar navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            if (page) {
                showPage(page);
            }
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            currentUser = null;
            document.getElementById('app').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex';
            showMessage('Logged out successfully', 'info');
        });
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('open');
            }
        });
    }
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('Login form submitted');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    console.log('Attempting login for:', email);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
            console.log('Login successful');
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showMainApp(data.user);
            showMessage('Login successful!', 'success');
        } else {
            console.error('Login failed:', data.message);
            showMessage(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('Register form submitted');
    
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
            showMainApp(data.user);
            showMessage('Registration successful!', 'success');
        } else {
            showMessage(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

function showMainApp(user) {
    console.log('Showing main application for user:', user);
    
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    const userName = document.getElementById('user-name');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (app) app.style.display = 'flex';
    if (userName && user) userName.textContent = user.username;
    
    // Set current user globally
    currentUser = user;
    
    // Show dashboard by default
    showPage('dashboard');
}

function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update menu
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
    
    currentPage = pageId;
    
    // Load page data based on page
    switch (pageId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'employees':
            loadEmployees();
            setupEmployeePage();
            break;
        case 'attendance':
            loadAttendance();
            setupAttendancePage();
            break;
        case 'leaves':
            loadLeaves();
            setupLeavesPage();
            break;
        case 'payroll':
            loadPayroll();
            setupPayrollPage();
            break;
        case 'expenses':
            loadExpenses();
            setupExpensesPage();
            break;
        case 'performance':
            loadPerformance();
            setupPerformancePage();
            break;
    }
}

// Page setup functions
function setupEmployeePage() {
    const addBtn = document.getElementById('add-employee-btn');
    if (addBtn && !addBtn.hasAttribute('data-listener-attached')) {
        addBtn.addEventListener('click', () => {
            showMessage('Add Employee functionality - Coming Soon!', 'info');
        });
        addBtn.setAttribute('data-listener-attached', 'true');
    }
}

function setupAttendancePage() {
    const checkInBtn = document.getElementById('check-in-btn');
    const checkOutBtn = document.getElementById('check-out-btn');
    
    if (checkInBtn && !checkInBtn.hasAttribute('data-listener-attached')) {
        checkInBtn.addEventListener('click', () => {
            showMessage('Check In functionality - Coming Soon!', 'info');
        });
        checkInBtn.setAttribute('data-listener-attached', 'true');
    }
    
    if (checkOutBtn && !checkOutBtn.hasAttribute('data-listener-attached')) {
        checkOutBtn.addEventListener('click', () => {
            showMessage('Check Out functionality - Coming Soon!', 'info');
        });
        checkOutBtn.setAttribute('data-listener-attached', 'true');
    }
}

function setupLeavesPage() {
    const applyBtn = document.getElementById('apply-leave-btn');
    if (applyBtn && !applyBtn.hasAttribute('data-listener-attached')) {
        applyBtn.addEventListener('click', () => {
            showMessage('Apply Leave functionality - Coming Soon!', 'info');
        });
        applyBtn.setAttribute('data-listener-attached', 'true');
    }
}

function setupPayrollPage() {
    const processBtn = document.getElementById('process-payroll-btn');
    if (processBtn && !processBtn.hasAttribute('data-listener-attached')) {
        processBtn.addEventListener('click', () => {
            showMessage('Process Payroll functionality - Coming Soon!', 'info');
        });
        processBtn.setAttribute('data-listener-attached', 'true');
    }
}

function setupExpensesPage() {
    const submitBtn = document.getElementById('submit-expense-btn');
    if (submitBtn && !submitBtn.hasAttribute('data-listener-attached')) {
        submitBtn.addEventListener('click', () => {
            showMessage('Submit Expense functionality - Coming Soon!', 'info');
        });
        submitBtn.setAttribute('data-listener-attached', 'true');
    }
}

function setupPerformancePage() {
    const createBtn = document.getElementById('create-review-btn');
    if (createBtn && !createBtn.hasAttribute('data-listener-attached')) {
        createBtn.addEventListener('click', () => {
            showMessage('Create Review functionality - Coming Soon!', 'info');
        });
        createBtn.setAttribute('data-listener-attached', 'true');
    }
}

// Data loading functions (simplified)
async function loadDashboard() {
    console.log('Loading dashboard');
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
    const totalEmployees = document.getElementById('total-employees');
    const presentToday = document.getElementById('present-today');
    const pendingLeaves = document.getElementById('pending-leaves');
    const monthlyPayroll = document.getElementById('monthly-payroll');
    
    if (totalEmployees) totalEmployees.textContent = stats.employees?.total || '0';
    if (presentToday) presentToday.textContent = stats.attendance?.present || '0';
    if (pendingLeaves) pendingLeaves.textContent = stats.leaves?.pending || '0';
    if (monthlyPayroll) monthlyPayroll.textContent = formatCurrency(stats.payroll?.monthlyTotal || 0);
}

async function loadEmployees() {
    console.log('Loading employees');
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
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Simplified loading functions for other pages
async function loadAttendance() {
    console.log('Loading attendance');
    // Simplified - just show empty table for now
    const tbody = document.querySelector('#attendance-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Attendance data will be loaded here</td></tr>';
    }
}

async function loadLeaves() {
    console.log('Loading leaves');
    const tbody = document.querySelector('#leaves-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Leave data will be loaded here</td></tr>';
    }
}

async function loadPayroll() {
    console.log('Loading payroll');
    const tbody = document.querySelector('#payroll-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Payroll data will be loaded here</td></tr>';
    }
}

async function loadExpenses() {
    console.log('Loading expenses');
    const tbody = document.querySelector('#expenses-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Expense data will be loaded here</td></tr>';
    }
}

async function loadPerformance() {
    console.log('Loading performance');
    const tbody = document.querySelector('#performance-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Performance data will be loaded here</td></tr>';
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function showLoginForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
}

function showRegisterForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

function showMessage(message, type) {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create a simple toast message
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'info' ? '#17a2b8' : '#ffc107'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

// Global functions for button actions
function editEmployee(id) {
    showMessage('Edit Employee functionality - Coming Soon!', 'info');
}

console.log('HR Pro initialization script ready');