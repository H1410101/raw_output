import { AppBootstrap } from "./AppBootstrap";

/**
 * The entry point for the Raw Output application.
 * Responsibility: Trigger the application bootstrap sequence once the DOM is ready.
 */
document.addEventListener("DOMContentLoaded", () => {
  const bootstrap: AppBootstrap = new AppBootstrap();

  bootstrap.initialize().catch((error: Error) => {
    console.error("Failed to initialize application:", error);
  });
});
