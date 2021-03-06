var chalk_global = require('chalk');

var symbol =
    process.platform === 'win32'
        ? {tick: '√', cross: '×'}
        : {tick: '✔', cross: '✖'};

function strmul(s, n) {
    var r = '';
    for (var i = 0; i < n; ++i) {
        r += s;
    }
    return r;
}

var SummaryOptionalConsoleReporter = function(baseReporterDecorator, config) {
    baseReporterDecorator(this);

    // Configuration
    config.summaryOptionalConsoleReporter =
        config.summaryOptionalConsoleReporter || {};
    var show = config.summaryOptionalConsoleReporter.show || 'failed';
    var specLength = config.summaryOptionalConsoleReporter.specLength || 50;
    var overviewColumn =
        config.summaryOptionalConsoleReporter.overviewColumn === false
            ? false
            : true;
    var consoleLogs =
        config.summaryOptionalConsoleReporter.consoleLogs === false
            ? false
            : true;
    var browserSummary =
        config.summaryOptionalConsoleReporter.browserSummary === false
            ? false
            : true;

    // We use our own instance, respecting config.color
    var chalk = new chalk_global.constructor({enabled: config.colors});

    var specorder, specresults;

    this.specSuccess = this.specFailure = this.specSkipped = function(
        browser,
        result
    ) {
        if (!result.suite) {
            return;
        }

        var specid = result.suite.join('/') + '/' + result.description;
        if (!(specid in specresults)) {
            specorder.push(specid);
            specresults[specid] = {
                spec: result.suite.slice().concat(result.description),
                results: Object.create(null),
            };
        }
        specresults[specid].results[browser.id] = result;
    };

    if (!consoleLogs) {
        this.onBrowserError = this.onBrowserLog = function() {};
    }

    // Previously printed spec path
    var currentPath;
    this.printSpecLabel = function(path) {
        var indent = '  ';
        path.forEach(function(s, i) {
            // We keep the current comon prefix and start to print
            // the new information on the first difference.
            if (i < currentPath.length && s != currentPath[i]) {
                currentPath.length = i;
            }
            if (i >= currentPath.length) {
                var label = indent + s;
                if (label.length > specLength) {
                    label = label.slice(0, specLength - 3) + '...';
                }
                this.writeCommonMsg(label);

                if (i < path.length - 1) {
                    this.writeCommonMsg('\n');
                } else {
                    this.writeCommonMsg(strmul(' ', specLength - label.length));
                }
                currentPath.push(s);
            }
            indent += '  ';
        }, this);
    };

    this.printResultLabel = function(result) {
        if (result === undefined) this.writeCommonMsg(chalk.yellow(' ? '));
        else if (result.skipped) this.writeCommonMsg(chalk.yellow(' - '));
        else if (result.success) {
            if (!result.partial)
                this.writeCommonMsg(chalk.green(' ' + symbol.tick + ' '));
            else this.writeCommonMsg(chalk.yellow('(' + symbol.tick + ')'));
        } else {
            this.writeCommonMsg(chalk.red(' ' + symbol.cross + ' '));
        }
    };

    this.printTableHeader = function(browsers) {
        this.writeCommonMsg(strmul(' ', specLength));
        if (overviewColumn) {
            this.writeCommonMsg(' all  ');
        }
        browsers.forEach(function(browser, i) {
            this.writeCommonMsg(' ' + i + ' ');
        }, this);
        this.writeCommonMsg('\n');
    };

    this.onRunStart = function() {
        this._browsers = [];
        currentPath = [];
        specorder = [];
        specresults = Object.create(null);
    };

    this.onRunComplete = function(browsers, results) {
        this.writeCommonMsg(chalk.bold(chalk.underline('SUMMARY')) + '\n');

        // Browser overview
        if (browserSummary) {
            browsers.forEach(function(browser, i) {
                this.writeCommonMsg(
                    ' ' + i + ': ' + this.renderBrowser(browser) + '\n'
                );
            }, this);
        }

        if (!specorder.length) {
            this.writeCommonMsg(chalk.red('No tests did run in any browsers.'));
            return;
        }

        var tableHeaderShown = false;

        // Test details
        var counts = {shown: 0, hidden: 0};
        specorder.forEach(function(specid) {
            var sr = specresults[specid];
            // Collect information from all browsers
            var summary = {skipped_some: false, ran_some: false, success: true};
            browsers.forEach(function(b) {
                if (sr.results[b.id]) {
                    if (sr.results[b.id].skipped) {
                        summary.skipped_some = true;
                    } else {
                        summary.ran_some = true;
                        summary.success =
                            summary.success && sr.results[b.id].success;
                    }
                } else {
                    summary.skipped_some = true;
                }
            });

            if (summary.success) {
                // Maybe we don't even want to show it
                if (show == 'failed') {
                    if (summary.ran_some) counts.hidden++;
                    return;
                }
                if (show == 'skipped' && !summary.skipped_some) {
                    if (summary.ran_some) counts.hidden++;
                    return;
                }
            }

            // We want to actually display it
            if (!tableHeaderShown) {
                this.printTableHeader(browsers);
                tableHeaderShown = true;
            }

            this.printSpecLabel(sr.spec);
            if (overviewColumn) {
                this.writeCommonMsg(' ');
                this.printResultLabel(summary);
                this.writeCommonMsg('  ');
            }
            browsers.forEach(function(browser, i) {
                this.printResultLabel(sr.results[browser.id], i);
            }, this);
            this.writeCommonMsg('\n');
            counts.shown++;
        }, this);

        if (counts.hidden) {
            this.writeCommonMsg(
                '  ' +
                    chalk.green('' + counts.hidden) +
                    (counts.shown ? ' more' : '') +
                    ' test cases successful in all browsers\n'
            );
        }
    };
};

SummaryOptionalConsoleReporter.$inject = ['baseReporterDecorator', 'config'];

module.exports = {
    'reporter:summary-optional-console': [
        'type',
        SummaryOptionalConsoleReporter,
    ],
};
