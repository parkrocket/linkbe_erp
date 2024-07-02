import React from 'react';

function Button({ children, onClick, className }) {
    return (
        <button onClick={onClick} className={`rounded-3xl ${className}`}>
            {children}
        </button>
    );
}

export default Button;
