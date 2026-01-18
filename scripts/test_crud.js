const { spawn } = require('child_process');
const http = require('http');

const PORT = 7001;
const BASE_URL = `http://localhost:${PORT}/api`;

let serverProcess;

function startServer() {
  console.log('Starting server...');
  serverProcess = spawn('node', ['server.js'], {
    stdio: 'pipe',
    env: { ...process.env, PORT: PORT.toString() }
  });

  serverProcess.stdout.on('data', (data) => {
    // console.log(`Server stdout: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });
}

async function waitForServer() {
  console.log('Waiting for server to be ready...');
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://localhost:${PORT}`);
      console.log('Server is ready!');
      return;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Server failed to start');
}

async function runTests() {
  try {
    startServer();
    await waitForServer();

    // 1. Login
    console.log('\n--- Testing Login ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hrpro.com',
        password: 'admin123'
      })
    });
    
    if (!loginRes.ok) {
      const text = await loginRes.text();
      throw new Error(`Login failed: ${loginRes.status} ${text}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login successful, got token.');

    // 2. Create Employee
    console.log('\n--- Testing Create Employee (POST) ---');
    const newEmployee = {
      employeeId: `TEST_${Date.now()}`,
      personalInfo: {
        firstName: 'Test',
        lastName: 'User',
        email: `test${Date.now()}@example.com`,
        phone: '1234567890'
      },
      employment: {
        department: 'IT',
        designation: 'Developer',
        role: 'employee',
        employmentType: 'full-time',
        dateOfJoining: new Date().toISOString()
      },
      salaryStructure: {
        ctc: 500000,
        basicSalary: 250000
      },
      bankDetails: {
        accountNumber: '123456789',
        ifscCode: 'TEST0001',
        bankName: 'Test Bank',
        accountHolderName: 'Test User'
      }
    };

    const createRes = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newEmployee)
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      console.error('Create failed:', JSON.stringify(createData, null, 2));
      throw new Error(`Create failed: ${createRes.status}`);
    }
    console.log('Employee created successfully:', createData.employee._id);
    const employeeId = createData.employee._id;

    // 3. Get All Employees
    console.log('\n--- Testing Get All Employees (GET) ---');
    const getAllRes = await fetch(`${BASE_URL}/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!getAllRes.ok) {
        throw new Error(`Get All failed: ${getAllRes.status}`);
    }
    const getAllData = await getAllRes.json();
    console.log(`Fetched ${getAllData.employees.length} employees.`);

    // 4. Update Employee
    console.log('\n--- Testing Update Employee (PUT) ---');
    const updateRes = await fetch(`${BASE_URL}/employees/${employeeId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        personalInfo: { firstName: 'UpdatedTest' }
      })
    });
    
    if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`Update failed: ${updateRes.status} ${text}`);
    }
    console.log('Employee updated successfully.');

    // 5. Delete Employee
    console.log('\n--- Testing Delete Employee (DELETE) ---');
    const deleteRes = await fetch(`${BASE_URL}/employees/${employeeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!deleteRes.ok) {
        const text = await deleteRes.text();
        throw new Error(`Delete failed: ${deleteRes.status} ${text}`);
    }
    console.log('Employee deleted successfully.');

    console.log('\n✅ ALL CRUD TESTS PASSED');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
      console.log('Server stopped.');
    }
    process.exit(0);
  }
}

runTests();
