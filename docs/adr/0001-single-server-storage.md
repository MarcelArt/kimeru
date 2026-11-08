# Use SQLite and persistent uploads on a single Docker host

Kimeru must be simple to self-host for individuals and organizations. The user chose a single-server Docker deployment with SQLite and accepted a persistent volume for uploaded images. This favors straightforward installation and backups over a distributed database and multi-server scaling; the database and uploaded assets must survive container replacement and be backed up together.
