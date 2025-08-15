export const handleUrl = (...url: string[]) => {
    return url
        .join('/')
        .replace(/\/+/g, '/') // Replace multiple consecutive slashes with single slash
        .replace(/\/+$/, ''); // Remove trailing slashes
};