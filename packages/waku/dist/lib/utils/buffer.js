export const parseFormData = async (buffer, contentType)=>{
    const response = new Response(buffer, {
        headers: {
            'content-type': contentType
        }
    });
    return response.formData();
};
export const bufferToString = (buffer)=>{
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
};

//# sourceMappingURL=buffer.js.map