
function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">
        India Post
        <span> Smart Delivery</span>
      </div>

      <div className="nav-links">
        <a href="/">Home</a>
        <a href="#booking">Book Parcel</a>
        <a href="#tracking">Track Parcel</a>
        <a href="#slots">Delivery Slots</a>
      </div>

      <button className="login-btn">
        Login
      </button>
    </nav>
  );
}

export default Navbar;
