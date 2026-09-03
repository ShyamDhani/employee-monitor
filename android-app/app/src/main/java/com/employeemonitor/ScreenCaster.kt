package com.employeemonitor

import android.util.Log
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.BlockingQueue
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

class ScreenCaster {

    companion object {
        private const val TAG = "ScreenCaster"
        private const val BOUNDARY = "mjpg-frame"
    }

    private val running = AtomicBoolean(false)
    private val clients = CopyOnWriteArrayList<Client>()
    private var serverSocket: ServerSocket? = null
    private var acceptThread: Thread? = null
    @Volatile private var lastFrame: ByteArray? = null

    private class Client(val socket: Socket) {
        val queue: BlockingQueue<ByteArray> = ArrayBlockingQueue(4)
        val output: OutputStream = socket.getOutputStream()
        var writerThread: Thread? = null
    }

    fun start(port: Int) {
        if (!running.compareAndSet(false, true)) return
        clients.clear()
        lastFrame = null
        try {
            serverSocket = ServerSocket(port)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bind port $port", e)
            running.set(false)
            return
        }
        acceptThread = Thread { acceptLoop() }.apply { name = "cast-accept"; start() }
        Log.d(TAG, "ScreenCaster started on port $port")
    }

    private fun acceptLoop() {
        while (running.get()) {
            val socket = try {
                serverSocket?.accept()
            } catch (e: Exception) {
                break
            }
            if (socket != null) onClient(socket)
        }
    }

    private fun onClient(socket: Socket) {
        try {
            socket.tcpNoDelay = true
            val client = Client(socket)
            val header = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: multipart/x-mixed-replace; boundary=$BOUNDARY\r\n" +
                "Cache-Control: no-cache, no-store\r\n" +
                "Connection: close\r\n\r\n"
            client.output.write(header.toByteArray())
            client.output.flush()
            clients.add(client)
            client.writerThread = Thread { writerLoop(client) }.apply { name = "cast-writer"; start() }
            lastFrame?.let { client.queue.offer(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to accept client", e)
            try { socket.close() } catch (_: Exception) {}
        }
    }

    private fun writerLoop(client: Client) {
        try {
            while (running.get() && !client.socket.isClosed) {
                val frame = client.queue.take()
                val out = client.output
                val part = "--$BOUNDARY\r\n" +
                    "Content-Type: image/jpeg\r\n" +
                    "Content-Length: ${frame.size}\r\n\r\n"
                out.write(part.toByteArray())
                out.write(frame)
                out.write("\r\n".toByteArray())
                out.flush()
            }
        } catch (e: Exception) {
            // Client disconnected or socket closed
        } finally {
            clients.remove(client)
            try { client.socket.close() } catch (_: Exception) {}
        }
    }

    fun broadcast(bytes: ByteArray) {
        if (clients.isEmpty()) return
        lastFrame = bytes
        for (client in clients) {
            if (!client.queue.offer(bytes)) {
                client.queue.poll()
                client.queue.offer(bytes)
            }
        }
    }

    fun clientCount(): Int = clients.size

    fun isRunning(): Boolean = running.get()

    fun stop() {
        if (!running.compareAndSet(true, false)) return
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
        acceptThread?.interrupt()
        acceptThread = null
        for (client in clients) {
            try { client.socket.close() } catch (_: Exception) {}
        }
        clients.clear()
        lastFrame = null
        Log.d(TAG, "ScreenCaster stopped")
    }
}
