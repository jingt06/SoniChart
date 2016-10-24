(function (H) {
    Highcharts.Chart.prototype.callbacks.push(function (chart) {
        if ( !chart.options.soniChart ) return chart; // return a usual chart if soniChart options is not given

        var options = chart.options.soniChart;
        chart.sonification = {};   // all sonification variables will be stored in chart.sonification
        var s = chart.sonification;
        s.offset = 0; // position
        s.speed = options.speed || 15;  // playspeed
        s.oscTypes = ['sine', 'square', 'triangle', 'sawtooth']; // supported osc types
        s.oscType = options.oscType || 'sine'; // default to triangle
        s.partial = options.partial || 6;
        s.running = false; // true if sound is playing
        s.Oscs = []
        // TODO: bound function will overwrite mapping function, should fix it later.
        if ( options.mapping ) {
            s.mapping = options.mapping;
        } else if ( options.bound ) {
            s.mapping = function( input ) {
                return options.bound.min + ( options.bound.max - options.bound.min ) *
                    (input - chart.yAxis[0].dataMin) /
                    (chart.yAxis[0].dataMax - chart.yAxis[0].dataMin);
            };
        } else {
            s.mapping = function( input ){ return input; };
        }
        for ( i in chart.series ) {
            s.Oscs.push( new Tone.Oscillator(0, s.oscType + s.partial ).toMaster() ); // Oscillator sound player
        }

        // ticker: a verticle line shows the position of player
        if ( ! options.ticker ) options.ticker = {};
        s.tickerOptions = {
            id: 'TICKER',
            enabled: ((options.ticker.enabled != null) ? options.ticker.enabled : true),
            value: chart.series[0].data[s.offset].x,
            color: options.ticker.color || 'red',
            width: options.ticker.width || 2,
        };
        if ( s.tickerOptions.enabled ) s.ticker = chart.xAxis[0].addPlotLine(s.tickerOptions).svgElem;

        // shaker: a horizontal line shows current frequency of each channel
        s.shakerOptions = [];
        if ( ! options.shaker ) {
            options.shaker = {};
        }
        s.shakers = [];
        for ( i in chart.series ) {
            var shakerOptions = {
                id: 'SHAKER',
                enabled: ((options.shaker.enabled != null) ? options.shaker.enabled : true),
                color: options.shaker.color || 'black',
                value : chart.series[i].data[s.offset].y,
                width: options.shaker.width || 1
            };
            s.shakerOptions.push( shakerOptions );
            if ( s.shakerOptions[i].enabled ) s.shakers.push( chart.yAxis[0].addPlotBand(shakerOptions).svgElem );
        }
        if ( ! options.playback ) options.playback = {};
        options.playback.playback = {}
        if ( options.playback.enabled == null || options.playback.enabled ){
            H.addEvent(chart.container, 'click', function (event) {
                if ( !event.point && !event.xAxis ) return; // return if this is a drag click event
                var clickX = (event.point ? event.point.x : event.xAxis[0].value);
                var newOffset = Math.floor( clickX / chart.xAxis[0].max * chart.xAxis[0].series[0].data.length );
                s.offset =  newOffset;
                if ( !s.running ) { // redraw ticker and shaker when not running
                    for ( i in s.Oscs ) {
                        if ( !chart.series[i].data[s.offset] ) continue;
                        var ySpan = chart.yAxis[0].max - chart.yAxis[0].min;
                        if ( s.shakerOptions[i].enabled ) s.shakers[i].translate(0, -(chart.plotHeight * chart.series[i].data[s.offset].y / ySpan));
                        console.log(ySpan, s.offset, chart.series[i].data[s.offset].y, chart.plotHeight, chart.series)
                        console.log(-(chart.plotHeight * chart.series[i].data[s.offset].y / ySpan))
                        var value = chart.series[i].data[s.offset].y;
                        s.Oscs[i].frequency.value = s.mapping(value);
                    }
                    if ( s.tickerOptions.enabled ) s.ticker.translate(s.offset / chart.xAxis[0].series[0].data.length * chart.plotWidth, 0);
                }
            });
        }

        var loop = function(){
            if ( s.running ) {
                for ( i in s.Oscs ) {
                    if ( !chart.series[i].data[s.offset] ) continue;
                    var value = chart.series[i].data[s.offset].y;
                    s.Oscs[i].frequency.value = s.mapping(value);
                    var ySpan = chart.yAxis[0].max - chart.yAxis[0].min;
                    if ( s.shakerOptions[i].enabled ) s.shakers[i].translate(0, -(chart.plotHeight * chart.series[i].data[s.offset].y / ySpan));
                }
                if ( s.tickerOptions.enabled ) s.ticker.translate(s.offset / chart.xAxis[0].series[0].data.length * chart.plotWidth, 0);

                s.offset = (s.offset + 1) % chart.series[0].data.length;
                setTimeout( loop, s.speed )
            }
        }

/*********************public functions:****************************/
        /****** chart.play ******
            play sound start from beginning
        *************************/
        chart.play = function() {
            if ( s.running ) return;
            s.offset = 0;
            for ( i in s.Oscs ) {
                s.Oscs[i].start();
            }
            //s.osc.start();
            s.running = true;
            loop();
        };

        /****** chart.start() ******
            play sound from previous stop/paused position
        ***************************/
        chart.start = function() {
            if ( s.running ) return;
            for ( i in s.Oscs ) {
                s.Oscs[i].start();
            }
            //s.osc.start();
            s.running = true;
            loop();
        };
        /****** chart.stop() ******
            stop playing sound
        ***************************/
        chart.stop = function() {
            s.running = false;
            for ( i in s.Oscs ) {
                s.Oscs[i].stop();
            }
        }

        /****** chart.pause() ******
            pause at current position, but continue make sound
        ***************************/
        chart.pause = function() {
            s.running = false;
        }

        /****** chart.mapping(mappingFn) ******
            change the value-sound mapping,
            the default mapping is directed mapping

            input:
                mappingFn: must be a function that comsumes a
                    number, return an integer or a string
                    represents frequency
        ***************************************/
        chart.mapping = function( mappingFn ) {
            s.mapping = mappingFn;
        }
        /****** chart.speed(num) ******
            change player speed
        *******************************/
        chart.speed = function (sp) {
            s.speed = sp;
        };

        /* TODO
        ******** chart.oscType( v, [arr] = null ) ********
            change volumn for series specified in array,
            if not specified, change all volumns
        *************************************************
        chart.oscType = function(type, arr) {
        }
        ******** chart.volumn( v, [arr] = null ) ********
            change volumn for series specified in array,
            if not specified, change all volumns
        *************************************************
        chart.volumn = function(vol, arr) {
        }

        */
    });
}(Highcharts));