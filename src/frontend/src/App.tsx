import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { EditorProvider } from "./context/EditorContext";
import EditorPage from "./pages/EditorPage";
import LandingPage from "./pages/LandingPage";

type View = "landing" | "editor";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [initialFile, setInitialFile] = useState<{
    bytes: Uint8Array;
    name: string;
  } | null>(null);

  const handleFileOpen = (bytes: Uint8Array, name: string) => {
    setInitialFile({ bytes, name });
    setView("editor");
  };

  const handleClose = () => {
    setInitialFile(null);
    setView("landing");
  };

  return (
    <>
      <Toaster richColors position="bottom-right" />
      {view === "landing" || !initialFile ? (
        <LandingPage onFileOpen={handleFileOpen} />
      ) : (
        <EditorProvider>
          <EditorPage
            initialBytes={initialFile.bytes}
            initialFileName={initialFile.name}
            onClose={handleClose}
          />
        </EditorProvider>
      )}
    </>
  );
}
