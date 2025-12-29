import loginHandler from './login';
import registerHandler from './register';
import oauthHandler from './oauth';

export default async function handler(request: Request) {
    const url = new URL(request.url);
    // Normalize the path by removing any trailing slash to make routing more robust
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
    }

    // Route requests based on the final path segment
    if (path.endsWith('/login')) {
        return loginHandler(request);
    }

    if (path.endsWith('/register')) {
        return registerHandler(request);
    }

    if (path.endsWith('/oauth')) {
        return oauthHandler(request);
    }

    // If no route matches, return a 404 using the original path for clarity
    return new Response(JSON.stringify({ message: `Route not found: ${url.pathname}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
    });
}