export function isAuthenticated(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  
  const token = authHeader.split(" ")[1];
  return token === process.env.APP_ACCESS_TOKEN;
}
