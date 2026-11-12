function AppShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F1F3F4] text-[#2F3E46]">
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}

export default AppShell;