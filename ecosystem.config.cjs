module.exports = {
	apps: [
		{
			name: 'contentfactory',
			script: 'build/index.js',
			instances: 1,
			exec_mode: 'fork',
			env: {
				NODE_ENV: 'production',
				PORT: 3000,
				BODY_SIZE_LIMIT: 524288000,
				SERVICE_ACCOUNT_PATH: './service-account.json'
			}
		}
	]
};
