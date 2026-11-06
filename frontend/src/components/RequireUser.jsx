import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext.jsx';

const RequireUser = ({ children }) => {
  const { user } = useUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default RequireUser;
