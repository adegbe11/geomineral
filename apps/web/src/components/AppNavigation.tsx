"use client";
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  ChevronDown,
  Compass,
  FolderOpen,
  Globe2,
  Home,
  Layers,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { User } from "@/lib/types";
import BrandMark from "./BrandMark";
type NavigationProps = {
  view: string;
  setView: (value: string) => void;
  user: User | null;
  setAuth: (value: "login" | "register") => void;
};
export function Sidebar({ view, setView, user, setAuth }: NavigationProps) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() => setView("Home")}
        aria-label="GeoMineral home"
      >
        <BrandMark />
        <span>
          GeoMineral<span className="brand-dot">.</span>
        </span>
      </button>
      <div className="workspace-label">YOUR EXPLORATION WORKSPACE</div>
      <nav>
        {[
          { title: "Home", icon: Home },
          { title: "Explore", icon: Compass },
          { title: "Scan", icon: Camera },
          { title: "Projects", icon: FolderOpen },
          { title: "Profile", icon: UserRound },
        ].map((item) => (
          <button
            key={item.title}
            className={view === item.title ? "active" : ""}
            onClick={() =>
              item.title === "Profile" && !user
                ? setAuth("login")
                : setView(item.title)
            }
          >
            <item.icon size={20} />
            {item.title}
            {view === item.title && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="nav-divider" />
      <nav>
        <button
          className={view === "Guide" ? "active" : ""}
          onClick={() => setView("Guide")}
        >
          <BookOpen size={20} />
          Mineral guide
        </button>
        <button
          className={view === "Sources" ? "active" : ""}
          onClick={() => setView("Sources")}
        >
          <Layers size={20} />
          Data & sources
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="evidence-card">
          <span className="evidence-card-icon">
            <ShieldCheck size={22} />
          </span>
          <h4>Grounded in evidence.</h4>
          <p>
            Geological intelligence.
            <br />
            Not mineral detection.
          </p>
          <button onClick={() => setView("Sources")}>
            Our approach <ArrowUpRight size={14} />
          </button>
        </div>
        <button
          className="sidebar-profile"
          onClick={() => (user ? setView("Profile") : setAuth("register"))}
        >
          <span className="avatar">
            {user ? (
              user.email.slice(0, 2).toUpperCase()
            ) : (
              <UserRound size={20} />
            )}
          </span>
          <span>
            <strong>
              {user ? user.email.split("@")[0] : "Your workspace"}
            </strong>
            <small>
              {user ? "Explorer account" : "Sign in to save your work"}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </aside>
  );
}
export function Topbar({
  view,
  setView,
  user,
  setAuth,
  professional,
  setProfessional,
}: NavigationProps & {
  professional: boolean;
  setProfessional: (value: boolean) => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span>
        <strong>
          {view === "Scan"
            ? "Identify a rock"
            : view === "Guide"
              ? "Mineral guide"
              : view === "Sources"
                ? "Data & sources"
                : view}
        </strong>
      </div>
      <div className="topbar-actions">
        <span className="global-tag">
          <Globe2 size={15} />
          Global coverage
        </span>
        <div className="mode-switch" aria-label="Explanation level">
          <button
            className={!professional ? "active" : ""}
            onClick={() => setProfessional(false)}
          >
            Simple
          </button>
          <button
            className={professional ? "active" : ""}
            onClick={() => setProfessional(true)}
          >
            Professional
          </button>
        </div>
        <button
          className="avatar top-avatar"
          aria-label="Profile"
          onClick={() => (user ? setView("Profile") : setAuth("login"))}
        >
          {user ? (
            user.email.slice(0, 1).toUpperCase()
          ) : (
            <UserRound size={18} />
          )}
        </button>
      </div>
    </header>
  );
}
