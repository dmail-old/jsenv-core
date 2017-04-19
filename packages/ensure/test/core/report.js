/*

*/

const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
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
	'cancelled report'() {
		// imaginong que je cancel une partie du test
		// qu'est ce qu'on obtient comme rapport ?
		// un rapport imcomplet mais de quelle nature ?
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
