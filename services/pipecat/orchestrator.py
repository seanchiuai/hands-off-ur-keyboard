"""
Simple HTTP orchestrator that spawns PipeCat agents for Daily rooms.
Receives webhooks from Next.js and starts voice agents.
"""

import os
import subprocess
import json
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Track running agents
active_agents = {}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'active_agents': len(active_agents)
    })

@app.route('/start-agent', methods=['POST'])
def start_agent():
    """
    Start a new PipeCat voice agent for a Daily room.

    Expected payload:
    {
        "room_url": "https://domain.daily.co/room-name",
        "token": "meeting_token",
        "session_id": "session_id",
        "user_id": "clerk_user_id"
    }
    """
    try:
        data = request.json

        # Validate required fields
        required_fields = ['room_url', 'token', 'session_id', 'user_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        room_url = data['room_url']
        token = data['token']
        session_id = data['session_id']
        user_id = data['user_id']

        # Build environment for the agent
        agent_env = os.environ.copy()
        agent_env.update({
            'DAILY_ROOM_URL': room_url,
            'DAILY_TOKEN': token,
            'SESSION_ID': session_id,
            'USER_ID': user_id,
        })

        # Start the agent as a subprocess
        print(f"🚀 Starting agent for session {session_id}...")
        print(f"   Room URL: {room_url}")
        print(f"   User ID: {user_id}")

        agent_process = subprocess.Popen(
            [f'{os.path.dirname(__file__)}/venv/bin/python', 'agent.py'],
            env=agent_env,
            cwd=os.path.dirname(__file__),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Combine stderr with stdout
        )

        # Track the agent
        active_agents[session_id] = {
            'process': agent_process,
            'room_url': room_url,
            'user_id': user_id,
        }

        # Read first few lines of output to check for errors
        try:
            import select
            import time
            time.sleep(0.5)  # Give process a moment to start

            # Check if process is still running
            if agent_process.poll() is not None:
                # Process already exited - read error
                output, _ = agent_process.communicate()
                print(f"❌ Agent crashed immediately:")
                print(output.decode('utf-8')[:500])
                del active_agents[session_id]
                return jsonify({'error': 'Agent crashed on startup', 'output': output.decode('utf-8')[:500]}), 500
        except Exception as e:
            print(f"⚠️  Could not check agent status: {e}")

        print(f"✅ Started voice agent for session {session_id} (PID: {agent_process.pid})")

        return jsonify({
            'success': True,
            'session_id': session_id,
            'pid': agent_process.pid,
        }), 200

    except Exception as e:
        print(f"❌ Error starting agent: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/stop-agent/<session_id>', methods=['POST'])
def stop_agent(session_id):
    """Stop a running voice agent"""
    try:
        if session_id not in active_agents:
            return jsonify({'error': 'Agent not found'}), 404

        agent_info = active_agents[session_id]
        process = agent_info['process']

        # Terminate the process
        process.terminate()
        process.wait(timeout=5)

        # Remove from active agents
        del active_agents[session_id]

        print(f"✅ Stopped voice agent for session {session_id}")

        return jsonify({'success': True}), 200

    except Exception as e:
        print(f"❌ Error stopping agent: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/agents', methods=['GET'])
def list_agents():
    """List all active agents"""
    agents = []
    for session_id, info in active_agents.items():
        agents.append({
            'session_id': session_id,
            'user_id': info['user_id'],
            'room_url': info['room_url'],
            'pid': info['process'].pid,
            'running': info['process'].poll() is None,
        })
    return jsonify({'agents': agents})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    print(f"🚀 PipeCat Orchestrator starting on port {port}...")
    print(f"📍 Endpoints:")
    print(f"   POST /start-agent - Start a new voice agent")
    print(f"   POST /stop-agent/<session_id> - Stop an agent")
    print(f"   GET /agents - List active agents")
    print(f"   GET /health - Health check")
    app.run(host='0.0.0.0', port=port, debug=True)
