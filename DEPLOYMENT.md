# EC2 Deployment Guide

## Current Deployment
- **EC2 IP**: http://16.171.182.225
- **Backend Port**: 8000
- **Frontend Port**: 5173 (default Vite dev) or 80 (production build)

## Backend Setup on EC2

1. **Install PostgreSQL** (if not already installed):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib python3-pip python3-venv -y
```

2. **Configure PostgreSQL**:
```bash
sudo -u postgres psql
CREATE DATABASE products;
CREATE USER aakash WITH PASSWORD 'root@123';
GRANT ALL PRIVILEGES ON DATABASE products TO aakash;
\q
```

3. **Clone and setup the backend**:
```bash
cd /home/ubuntu  # or your home directory
git clone <your-repo-url> fulfil
cd fulfil/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

4. **Run the backend** (with public access):
```bash
# For development/testing
uvicorn main:app --host 0.0.0.0 --port 8000

# For production (using systemd service)
sudo nano /etc/systemd/system/fulfil-backend.service
```

**Backend Service File** (`/etc/systemd/system/fulfil-backend.service`):
```ini
[Unit]
Description=Fulfil Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/fulfil/backend
Environment="PATH=/home/ubuntu/fulfil/backend/venv/bin"
ExecStart=/home/ubuntu/fulfil/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fulfil-backend
sudo systemctl start fulfil-backend
sudo systemctl status fulfil-backend
```

## Frontend Setup on EC2

1. **Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

2. **Build the frontend**:
```bash
cd /home/ubuntu/fulfil/frontend
npm install
npm run build
```

3. **Serve with Nginx** (production):
```bash
sudo apt install nginx -y
```

**Nginx Config** (`/etc/nginx/sites-available/fulfil`):
```nginx
server {
    listen 80;
    server_name 16.171.182.225;

    root /home/ubuntu/fulfil/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and start:
```bash
sudo ln -s /etc/nginx/sites-available/fulfil /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Or Run Frontend in Dev Mode

```bash
cd /home/ubuntu/fulfil/frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

## Security: AWS Security Group

Make sure your EC2 instance's security group allows:
- **Port 22**: SSH (your IP only)
- **Port 80**: HTTP (0.0.0.0/0)
- **Port 8000**: Backend API (0.0.0.0/0)
- **Port 5173**: Vite dev server (0.0.0.0/0) - only if using dev mode

## Updating the Code

After pushing changes:
```bash
# On EC2
cd /home/ubuntu/fulfil
git pull origin main

# Restart backend
sudo systemctl restart fulfil-backend

# Rebuild and serve frontend
cd frontend
npm install
npm run build
sudo systemctl restart nginx
```

## Troubleshooting

1. **Check backend logs**:
```bash
sudo journalctl -u fulfil-backend -f
```

2. **Check nginx logs**:
```bash
sudo tail -f /var/log/nginx/error.log
```

3. **Check if ports are open**:
```bash
sudo netstat -tulpn | grep -E ':(80|8000|5173)'
```

4. **Test backend directly**:
```bash
curl http://localhost:8000/
```

