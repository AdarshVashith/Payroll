# HR Pro - Full Stack Human Resource Management System

A comprehensive HR management system built with Node.js, Express, MongoDB, and vanilla JavaScript. This system provides complete employee lifecycle management, payroll processing, attendance tracking, leave management, expense claims, and performance reviews.

## Features

### 🏢 Employee Lifecycle Management
- Complete employee onboarding process
- Employee profile management
- Promotion and transfer tracking
- Exit interview documentation
- Document management

### ⏰ Attendance & Time Tracking
- Web-based check-in/check-out
- Geolocation support for attendance
- Break time tracking
- Overtime calculation
- Attendance reports and analytics

### 🏖️ Leave Management
- Multiple leave types (vacation, sick, personal, etc.)
- Leave balance tracking
- Approval workflow
- Holiday calendar integration
- Leave history and reports

### 💰 Payroll Management
- Automated payroll processing
- Tax calculations (federal, state, social security, medicare)
- Salary structure management
- Overtime and bonus calculations
- Payroll reports and pay slips

### 💳 Expense Management
- Expense claim submission
- Multi-level approval workflow
- Receipt management
- Expense categories and reporting
- Integration with accounting systems

### 🏆 Performance Management
- Goal setting and tracking
- KRA (Key Result Areas) alignment
- Self-evaluation tools
- Performance review cycles
- 360-degree feedback

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Moment.js** - Date manipulation

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with modern features
- **Vanilla JavaScript** - Client-side logic
- **Chart.js** - Data visualization
- **Font Awesome** - Icons

### Security & Validation
- **Helmet** - Security headers
- **Express Rate Limit** - Rate limiting
- **Express Validator** - Input validation
- **CORS** - Cross-origin resource sharing

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hr-payroll-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hr_payroll
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here
JWT_EXPIRE=30d

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Company Settings
COMPANY_NAME=HR Pro Solutions
COMPANY_ADDRESS=123 Business Street, City, State 12345
COMPANY_PHONE=+1-555-0123
COMPANY_EMAIL=info@hrpro.com
```

### 4. Database Setup
Make sure MongoDB is running on your system, then seed the database with sample data:
```bash
npm run seed
```

### 5. Start the Application
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:5000`

## Sample Login Credentials

After running the seed script, you can use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hrpro.com | admin123 |
| HR Manager | hr@hrpro.com | hr123 |
| Employee | john.doe@hrpro.com | employee123 |
| Employee | jane.smith@hrpro.com | employee123 |
| Manager | mike.johnson@hrpro.com | manager123 |

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Employee Management
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/:id` - Get employee by ID
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Attendance Management
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/checkin` - Check in employee
- `POST /api/attendance/checkout` - Check out employee
- `POST /api/attendance/break/start` - Start break
- `POST /api/attendance/break/end` - End break

### Leave Management
- `GET /api/leaves` - Get leave requests
- `POST /api/leaves` - Apply for leave
- `PUT /api/leaves/:id/approve` - Approve leave
- `PUT /api/leaves/:id/reject` - Reject leave

### Payroll Management
- `GET /api/payroll` - Get payroll records
- `POST /api/payroll` - Create payroll record
- `PUT /api/payroll/:id` - Update payroll
- `POST /api/payroll/:id/process` - Process payroll
- `POST /api/payroll/:id/pay` - Mark as paid

### Expense Management
- `GET /api/expenses` - Get expense claims
- `POST /api/expenses` - Submit expense claim
- `PUT /api/expenses/:id/approve` - Approve expense
- `PUT /api/expenses/:id/reject` - Reject expense

### Performance Management
- `GET /api/performance/reviews` - Get performance reviews
- `POST /api/performance/reviews` - Create review
- `PUT /api/performance/reviews/:id` - Update review

### Dashboard & Reports
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-activities` - Get recent activities
- `GET /api/dashboard/charts/attendance` - Attendance chart data
- `GET /api/dashboard/charts/payroll` - Payroll chart data

## Project Structure

```
hr-payroll-system/
├── models/                 # Database models
│   ├── User.js
│   ├── Employee.js
│   ├── Payroll.js
│   ├── Attendance.js
│   ├── Leave.js
│   └── Expense.js
├── routes/                 # API routes
│   ├── auth.js
│   ├── employees.js
│   ├── payroll.js
│   ├── attendance.js
│   ├── leaves.js
│   ├── expenses.js
│   ├── performance.js
│   └── dashboard.js
├── middleware/             # Custom middleware
│   └── auth.js
├── public/                 # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── scripts/                # Utility scripts
│   └── seedData.js
├── server.js              # Main server file
├── package.json
├── .env
└── README.md
```

## Features in Detail

### Dashboard
- Real-time statistics and KPIs
- Recent activities feed
- Department-wise employee distribution
- Attendance and payroll charts

### Employee Management
- Complete employee profiles
- Department and position management
- Employee search and filtering
- Document upload and management

### Attendance System
- Web-based time tracking
- Geolocation verification
- Break time management
- Overtime calculation
- Attendance reports

### Leave Management
- Multiple leave types
- Leave balance tracking
- Approval workflows
- Leave calendar
- Email notifications

### Payroll Processing
- Automated calculations
- Tax deductions
- Overtime and bonus processing
- Pay slip generation
- Payroll reports

### Expense Management
- Easy expense submission
- Receipt upload
- Multi-level approvals
- Expense categories
- Reimbursement tracking

### Performance Reviews
- Goal setting and tracking
- Performance ratings
- Review cycles
- Development planning
- Performance analytics

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers with Helmet
- Role-based access control

## Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=80
MONGODB_URI=mongodb://your-production-db-url
JWT_SECRET=your-production-jwt-secret
```

### Docker Deployment (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact:
- Email: support@hrpro.com
- Documentation: [Link to docs]
- Issues: [GitHub Issues]

## Roadmap

- [ ] Mobile app development
- [ ] Advanced reporting and analytics
- [ ] Integration with external payroll services
- [ ] Multi-language support
- [ ] Advanced workflow automation
- [ ] AI-powered insights and recommendations