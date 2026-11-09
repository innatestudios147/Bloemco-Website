import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Header() {
  const [open, setOpen] = useState(false);
  const { isStaff, signOut } = useAuth();

  return (
    <header>
      <div className="logo-wrapper">
        <a href="/" className="logo-link">
          <img src="/wp-content/uploads/2026/05/bloem-co-presentation-logo-01.svg" alt="Bloem Co Logo" className="logo-img" />
        </a>
      </div>
      <nav id="nav-menu" className={open ? 'active' : ''}>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/services/">Services</a></li>
          <li><a href="/projects/">Projects</a></li>
          <li><Link to="/blog" className="is-current">Blog</Link></li>
          <li><a href="/team/">Team</a></li>
          <li><a href="/contact/">Contact</a></li>
          {isStaff && (
            <>
              <li><Link to="/staff">Staff portal</Link></li>
              <li><button className="link-btn" onClick={() => signOut()} style={{ fontSize: 16 }}>Sign out</button></li>
            </>
          )}
        </ul>
      </nav>
      <button
        className={`hamburger${open ? ' active' : ''}`}
        aria-label="Open menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span></span><span></span><span></span>
      </button>
    </header>
  );
}
