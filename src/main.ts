import "./styles/palette.css";
import "./styles/kovaaks_search.css";
import { AppBootstrap } from "./AppBootstrap";

/**
 * The entry point for the Raw Output application.
 * Responsibility: Trigger the application bootstrap sequence once the DOM is ready.
 */
document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
  const bootstrap: AppBootstrap = new AppBootstrap();

  try {
    await bootstrap.initialize();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Failed to initialize application:", error.message);
    } else {
      console.error("Failed to initialize application:", String(error));
    }
  }
});
