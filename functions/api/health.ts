/**
 * Health check endpoint to verify connectivity between the frontend and Cloudflare Edge.
 * Returns basic environment info and a pong message.
 */
export const onRequest: PagesFunction = async (context) => {
  const timestamp = new Date().toISOString();
  
  const responseData = {
    status: "online",
    message: "Edge Handshake Successful",
    timestamp,
    environment: context.env.ENVIRONMENT || "development",
  };

  return new Response(JSON.stringify(responseData), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
