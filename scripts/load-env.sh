#!/bin/bash

# Better .env file loader that handles quotes and special characters

load_env() {
    local env_file="${1:-.env}"
    
    if [ ! -f "$env_file" ]; then
        return 1
    fi
    
    # Read .env file line by line
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        if [[ -z "$line" || "$line" =~ ^# ]]; then
            continue
        fi
        
        # Export the variable
        export "$line"
    done < "$env_file"
    
    return 0
}

# Load from .env file
if load_env ".env"; then
    echo "✅ Loaded environment from .env"
elif load_env "frontend/.env.local"; then
    echo "✅ Loaded environment from frontend/.env.local"
elif load_env "frontend/.env"; then
    echo "✅ Loaded environment from frontend/.env"
else
    echo "⚠️  No .env file found"
fi