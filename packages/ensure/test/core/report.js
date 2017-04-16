/*

*/

const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
	// tester le rapport de résultat (il doit bien contenir le report de tous les tests)
	'assertion returning false'({test}, assert) {
		return test(
			'i am false',
			() => false
		)().then(
			(report) => {
				assert.equal(report.state, 'failed')
				const assertionReport = report.detail[0]
				assert.equal(assertionReport.state, 'failed')
				const assertionError = assertionReport.detail
				assert.equal(assertionError.name, 'AssertionError')
				assert.equal(assertionError.code, 'RESOLVED_TO_FALSE')
				assert.equal(assertionError.message, 'i am false resolved to false')
			}
		)
	},
	'duration of sync function'({test}, assert) {
		return test(
			() => {}
		)().then(
			(report) => {
				const assertionReport = report.detail[0]
				const {duration} = assertionReport
				assert(duration > 0 && duration < 0.1)
			}
		)
	},
	'duration of async function'({test}, assert) {
		return test(
			() => createPromiseResolvedIn(50)
		)().then(
			(report) => {
				const assertionReport = report.detail[0]
				const {duration} = assertionReport
				assert(duration > 40 && duration < 60)
			}
		)
	}
}
