import { Navigate } from "react-router-dom";

// UserDashboard is now consolidated into CustomerDashboardPage at /account
export default function UserDashboard() {
  return <Navigate to="/account" replace />;
}
