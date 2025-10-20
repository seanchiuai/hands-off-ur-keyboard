import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

type VoiceButtonProps = {
  onStart?: () => void;
  disabled?: boolean;
};

/**
 * Lightweight placeholder that lets the research agent plug in a Pipecat
 * session later. It keeps the UI slot occupied without depending on the old
 * voice shopping stack.
 */
export function VoiceButton({ onStart, disabled }: VoiceButtonProps) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onStart}
      className="gap-2 bg-purple-600 hover:bg-purple-700"
    >
      <Mic className="h-4 w-4" />
      Talk to Research Agent
    </Button>
  );
}
