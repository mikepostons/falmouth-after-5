let csrf = "";
export async function api(action, body, method) {
  const options = { credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    options.method = method || "POST";
    options.headers["X-CSRF-Token"] = csrf;
    if (body instanceof FormData) options.body = body;
    else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }
  const response = await fetch(
    `./api.php?action=${encodeURIComponent(action)}`,
    options,
  );
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The service could not be reached. Please try again.");
  }
  if (!response.ok) {
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  if (result.csrf) csrf = result.csrf;
  return result;
}
