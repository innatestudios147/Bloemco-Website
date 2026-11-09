export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-brand">
          <img src="/wp-content/uploads/2026/05/bloem-co-presentation-logo-01.svg" alt="Bloem Co" className="footer-logo" />
          <p>A proudly South African, multidisciplinary consultancy dedicated to bringing clarity to complex programmes.</p>
        </div>
        <div className="footer-links">
          <h4>Explore</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/services/">Services</a></li>
            <li><a href="/projects/">Projects</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/team/">Team</a></li>
            <li><a href="/contact/">Contact</a></li>
          </ul>
        </div>
        <div className="footer-links">
          <h4>Contact Info</h4>
          <ul>
            <li><a href="mailto:info@bloem-co.com">info@bloem-co.com</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom"><p>© {year} Bloem Consulting Services. All rights reserved.</p></div>
    </footer>
  );
}
