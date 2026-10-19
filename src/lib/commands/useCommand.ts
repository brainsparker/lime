import { useEffect } from "react";
import { registerCommand, type CommandRegistration } from "./registry";

export function useCommand(command: CommandRegistration) {
  useEffect(() => registerCommand(command), [command]);
}
