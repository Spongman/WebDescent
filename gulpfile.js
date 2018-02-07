const gulp = require('gulp');
const util = require('gulp-util');
const ts = require('gulp-typescript');
const watch = require('gulp-watch');
const uglifyes = require('uglify-es');
const composer = require('gulp-uglify/composer');
const uglify = composer(uglifyes, console);
const sourcemaps = require('gulp-sourcemaps');
const clean = require('gulp-clean');
const browserSync = require('browser-sync');
const config = {
	production: !!util.env.production,
};

function bundle(file) {
	var tsProject = ts.createProject('src/tsconfig.json', {
		module: 'amd',
		out: file + '.js'
	});

	return gulp.src(['src/Typescript/' + file + '.ts'])
		.pipe(sourcemaps.init())
		.pipe(tsProject()).js
		.pipe(config.production ? uglify() : util.noop())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('dist'))
		.pipe(browserSync.reload({ stream: true, once: true }));
}

gulp.task('main', () => bundle('index'));
gulp.task('worker', () => bundle('Visibility_worker'));

gulp.task('typescript', ['main', 'worker']);

gulp.task('javascript', function () {

	gulp.src('src/Scripts/*.js')
		.pipe(config.production ? uglify() : util.noop())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('dist'))
		.pipe(browserSync.reload({ stream: true, once: true }));
});

/*
copy all html files and assets
*/
gulp.task('html', function () {
	gulp.src('src/**/*.html')
		.pipe(gulp.dest('dist'))
		.pipe(browserSync.reload({ stream: true, once: true }));
});

gulp.task('assets', function () {
	gulp.src('assets/**/*.*')
		.pipe(gulp.dest('dist/assets'))
		.pipe(browserSync.reload({ stream: true, once: true }));
});
/*
compile less files
gulp.task('less', function () {
	gulp.src('src/styles/style.less')
		.pipe(less())
		.pipe(sourcemaps.init())
		.pipe(config.production ? uglifycss({
			"maxLineLen": 80,
			"uglyComments": true
		}) : util.noop())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('dist/styles'));
});
*/

/*
Watch typescript and less
*/
gulp.task('watch',
	['browser-sync'],
	function () {
		//gulp.watch('src/styles/*.less', ['less']);
		gulp.watch(['src/**/*.ts', 'src/**/*.tsx', 'src/tsconfig.json'], ['typescript']);
		gulp.watch('src/**/*.js', ['javascript']);
		gulp.watch('src/**/*.html', ['html']);
		gulp.watch('assets/**/*.*', ['assets']);
	});

gulp.task('clean', () =>
	gulp.src('./dist', { read: false })
		.pipe(clean())
);

gulp.on('err', function (e) {
	console.log(e.err.stack);
});

gulp.task('browser-sync', function () {
	browserSync.init(null, {
		server: {
			baseDir: "dist"
		}
	});
});
gulp.task('bs-reload', function () {
	browserSync.reload();
});

/*
default task
*/

gulp.task('default', ['typescript', 'javascript', 'html', 'assets']);
gulp.task('serve', ['default', 'watch']);
