import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  authProviderLabel,
  mergedProfileForUser,
  profileDisplayName,
  profileInitials,
  saveStoredProfile,
} from "../utils/userProfile";
import "./ProfilePage.css";

function normalized(profile) {
  return {
    firstName: String(profile?.firstName || "").trim(),
    lastName: String(profile?.lastName || "").trim(),
    email: String(profile?.email || "").trim(),
    phone: String(profile?.phone || "").trim(),
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth0();

  const initialProfile = useMemo(() => mergedProfileForUser(user), [user]);
  const [profile, setProfile] = useState(initialProfile);
  const [baseline, setBaseline] = useState(initialProfile);
  const [status, setStatus] = useState("");
  const [showUserId, setShowUserId] = useState(false);

  useEffect(() => {
    setProfile(initialProfile);
    setBaseline(initialProfile);
    setStatus("");
    setShowUserId(false);
    document.title = "Profile — Voxidria";
  }, [initialProfile]);

  const displayName = profileDisplayName(user, profile);
  const initials = profileInitials(user, profile);
  const providerLabel = authProviderLabel(user);
  const dirty = JSON.stringify(normalized(profile)) !== JSON.stringify(normalized(baseline));

  const onChange = (key) => (e) => {
    setProfile((prev) => ({ ...prev, [key]: e.target.value }));
    if (status) setStatus("");
  };

  const onSave = (e) => {
    e.preventDefault();
    if (!user?.sub) return;
    saveStoredProfile(user.sub, profile);
    const fresh = normalized(profile);
    setBaseline(fresh);
    setProfile(fresh);
    setStatus("Profile saved.");
  };

  return (
    <>
      <nav className="pf-nav">
        <div className="pf-nav-logo" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="Voxidria" height="38" />
        </div>
        <div className="pf-nav-actions">
          <button className="pf-btn pf-btn-outline" onClick={() => navigate("/")}>
            Dashboard
          </button>
          <button
            className="pf-btn pf-btn-outline"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Sign Out
          </button>
          <button className="pf-btn pf-btn-primary" onClick={() => navigate("/record")}>
            + New Screening
          </button>
        </div>
      </nav>

      <main className="pf-main">
        <div className="pf-page-title">Profile</div>
        <div className="pf-page-sub">Manage account information used in your dashboard experience.</div>

        <section className="pf-card">
          <div className="pf-card-title">Account Summary</div>
          <div className="pf-summary">
            <div className="pf-avatar-wrap">
              {user?.picture ? (
                <img src={user.picture} alt={displayName} className="pf-avatar" />
              ) : (
                <div className="pf-initials">{initials}</div>
              )}
            </div>
            <div className="pf-summary-copy">
              <div className="pf-display-name">{displayName}</div>
              <div className="pf-provider">{providerLabel}</div>
              <button
                type="button"
                className="pf-user-id-toggle"
                onClick={() => setShowUserId((prev) => !prev)}
              >
                {showUserId ? "Hide account ID" : "Show account ID"}
              </button>
              {showUserId && <div className="pf-user-id">ID: {user?.sub || "Unavailable"}</div>}
            </div>
          </div>
        </section>

        <section className="pf-card">
          <div className="pf-card-title">Personal Details</div>
          <form className="pf-form" onSubmit={onSave}>
            <div className="pf-grid">
              <label className="pf-field">
                <span>First Name</span>
                <input type="text" value={profile.firstName || ""} onChange={onChange("firstName")} />
              </label>
              <label className="pf-field">
                <span>Last Name</span>
                <input type="text" value={profile.lastName || ""} onChange={onChange("lastName")} />
              </label>
              <label className="pf-field">
                <span>Email</span>
                <input type="email" value={profile.email || ""} onChange={onChange("email")} />
              </label>
              <label className="pf-field">
                <span>Phone Number</span>
                <input type="tel" value={profile.phone || ""} onChange={onChange("phone")} />
              </label>
            </div>

            <div className="pf-note">
              Profile edits are currently stored in this browser for your signed-in account.
            </div>

            <div className="pf-actions">
              <button type="button" className="pf-btn pf-btn-outline" onClick={() => navigate("/")}>
                Back
              </button>
              <button type="submit" className="pf-btn pf-btn-primary" disabled={!dirty}>
                Save Changes
              </button>
            </div>

            {status && <div className="pf-status">{status}</div>}
          </form>
        </section>
      </main>
    </>
  );
}
