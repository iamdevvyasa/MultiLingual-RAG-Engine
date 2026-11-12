import { useCallback, useState } from "react";
import AppShell from "./components/layout/AppShell";
import Conversation from "./components/conversation/Conversation";
import VoiceExperience from "./components/voice/VoiceExperience";
import FeatureSwitcher from "./components/mode/FeatureSwitcher";
import UploadAskExperience from "./components/documents/UploadAskExperience";
import useRagExperience from "./hooks/useRagExperience";

function App() {
  const {
    messages,
    isProcessing,
    statusUpdates,
    submitQuery,
    clearConversation,
  } = useRagExperience();
  const [mode, setMode] = useState("knowledge");

  const handleModeChange = useCallback((nextMode) => {
    setMode(nextMode);
    clearConversation();
  }, [clearConversation]);

  const handleVoiceQuery = useCallback(
    (query) => {
      if (!query) {
        return;
      }
      submitQuery(query);
    },
    [submitQuery],
  );

  return (
    <AppShell>
      <FeatureSwitcher mode={mode} onChange={handleModeChange} />

      {mode === "documents" && (
        <UploadAskExperience
          onSubmit={submitQuery}
          hasConversation={messages.length > 0}
          isProcessing={isProcessing}
        />
      )}

      <Conversation
        messages={messages}
        isProcessing={isProcessing}
        statusUpdates={statusUpdates}
      />

      {mode === "knowledge" && (
        <VoiceExperience
          onVoiceQuery={handleVoiceQuery}
          hasConversation={messages.length > 0}
          isProcessing={isProcessing}
        />
      )}
    </AppShell>
  );
}

export default App;