import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import "./Header.css";

export default function Header() {
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0();

  return (
    <header className="header">
      <Link to="/" className="header-brand">
        <img src="/logo.png" alt="" className="header-logo" />
        <span>Voxidria</span>
      </Link>

      <nav className="header-nav">
        {isAuthenticated ? (
          <>
            <Link to="/record" className="nav-link">
              New Recording
            </Link>
            <div className="header-user">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="header-avatar"
                />
              )}
              <span className="header-name">{user?.name}</span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
              >
                Log out
              </button>
            </div>
          </>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => loginWithRedirect()}
          >
            Log in
          </button>
        )}
      </nav>
    </header>
  );
}
