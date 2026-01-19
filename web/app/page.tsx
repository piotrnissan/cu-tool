export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Component Usage Tool</h1>
      <p>Tech Spike 2 POC - Cross-market automotive component analyzer</p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Status</h2>
        <p>✓ Web app running</p>
        <p>
          API endpoint: <code>http://localhost:3002</code>
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Next Steps</h2>
        <ul>
          <li>Implement URL inventory</li>
          <li>Build fetch layer</li>
          <li>Create parsing engine</li>
          <li>Add Q&A interface</li>
        </ul>
      </section>
    </main>
  );
}
