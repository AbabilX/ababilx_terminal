import { useEffect } from "react";
import { ping } from "./lib/tauri";
import { Terminal } from "./components/terminal";

function App() {
  useEffect(() => {
    ping().then((result) => {
      console.log("Rust:", result);
    });
  }, []);

  return (
    <main className="w-screen h-screen">
      <Terminal />
    </main>
  );
}

export default App;
