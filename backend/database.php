<?php
/**
 * =====================================================================
 * REMQUIP NEXUS - DATABASE CONNECTION
 * =====================================================================
 */

class Database {
    private $host;
    private $username;
    private $password;
    private $database;
    private $charset;
    private $port;
    public $conn;

    public function __construct() {
        $this->host = DB_HOST;
        $this->username = DB_USER;
        $this->password = DB_PASS;
        $this->database = DB_NAME;
        $this->port = (int)DB_PORT;
        $this->charset = DB_CHARSET;
    }

    /**
     * Get database connection
     * @return PDO|null
     */
    public function getConnection() {
        $this->conn = null;
        
        try {
            $dsn = "mysql:host=" . $this->host .
                   ";port=" . $this->port .
                   ";dbname=" . $this->database .
                   ";charset=" . $this->charset;
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];
            
            $this->conn = new PDO(
                $dsn,
                $this->username,
                $this->password,
                $options
            );
            
            Logger::info('Database connected successfully', [
                'host' => $this->host,
                'database' => $this->database
            ]);
            
        } catch(PDOException $e) {
            Logger::error('Database connection failed', [
                'host' => $this->host,
                'error' => $e->getMessage()
            ]);
            
            if (DEBUG_MODE) {
                ResponseHelper::sendError('Connection error: ' . $e->getMessage(), 500);
            } else {
                ResponseHelper::sendError('Database connection failed', 500);
            }
            exit;
        }
        
        return $this->conn;
    }

    /**
     * @return PDOStatement
     */
    public function prepare($query) {
        return $this->conn->prepare($query);
    }

    /**
     * Close database connection
     */
    public function closeConnection() {
        $this->conn = null;
    }

    /**
     * Test database connection
     * @return bool
     */
    public function testConnection() {
        try {
            $stmt = $this->conn->query("SELECT 1");
            return $stmt !== false;
        } catch (Exception $e) {
            Logger::error('Database test failed', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Execute a query
     * @param string $query
     * @param array $params
     * @return mixed
     */
    public function execute($query, $params = []) {
        try {
            $stmt = $this->conn->prepare($query);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            Logger::error('Query execution failed', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Fetch all results
     * @param string $query
     * @param array $params
     * @return array
     */
    public function fetchAll($query, $params = []) {
        $stmt = $this->execute($query, $params);
        return $stmt->fetchAll();
    }

    /**
     * Fetch single result
     * @param string $query
     * @param array $params
     * @return mixed
     */
    public function fetch($query, $params = []) {
        $stmt = $this->execute($query, $params);
        return $stmt->fetch();
    }

    /**
     * Get last insert ID
     * @return string
     */
    public function lastInsertId() {
        return $this->conn->lastInsertId();
    }

    /**
     * Get row count
     * @param string $query
     * @param array $params
     * @return int
     */
    public function count($query, $params = []) {
        $stmt = $this->execute($query, $params);
        return (int)$stmt->fetchColumn();
    }
}
