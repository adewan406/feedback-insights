export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">FI</span>
        <span>Feedback Insights</span>
      </div>
      <nav>
        <a className="nav-item active" href="#">Overview</a>
        <a className="nav-item" href="#feedback">All feedback</a>
        <a className="nav-item" href="#report">AI report</a>
      </nav>
      <p className="sidebar-foot">Demo workspace · QuickBite</p>
    </aside>
  );
}
