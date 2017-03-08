var request = require('request'),
    cheerio = require('cheerio'),
    url     = require('url'),
		json2csv= require('json2csv'),
    fs      = require('fs'),
		express = require('express'),
    app     = express(),
    server  = app.listen(8080),
    io      = require('socket.io').listen(server),
    su      = [],
    out_arr = [],
    uri_arr = [];

app.use(express.static(__dirname));   

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/home.html');
});

io.on('connection', function(socket) {
  socket.on('search', function(key, loc, subloc){	
    su = subloc.split(',');

    first(1, key, loc, su, 0);
  });

  socket.on('error', function(e) {
  	console.log(e);
		io.emit('err', e);
  });
});

function first(run, key, loc, su, ind){
  var options = {
    url: 'http://www.justdial.com/functions/ajxsearch.php?national_search=0&act=pagination&city='+loc+'&search='+key+'&where='+su[ind]+'&catid=&psearch=&prid=&page='+run+'&SID=&mntypgrp=0',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.155 Safari/537.36'
    }
  };

  request(options, function(err, res, htm){
    if (!err) {    	
      var json = JSON.parse(htm);
      var $ = cheerio.load(json.markup);
      var len = $('.cntanr').length - 1;

      $('.cntanr').each(function(i, j){
        uri_arr.push($(this).find($('.jcn a')).attr('href'));
        
				io.emit('status', 'Fetching URL of Page: '+run+'/'+json.lastPageNum);

        if (i >= len) {
          run < json.lastPageNum ? first(++run, key, loc, su, ind) : ++ind >= su.length ? second(0) : first(1, key, loc, su, ind);      
        }		
      });
    } else {
      console.log(err);
	  	io.emit('err', err);
    }
  });
}

function second(index){
  var option = {
    url: uri_arr[index],
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.155 Safari/537.36'
    }
  };

  request(option, function(error, response, html){
    if (!error) {
      var $    = cheerio.load(html),
        ct     = $('#mpctr').val(),
        docid  = $('#mpdocid').val(),
        paid   = $('#paid_status').val();

      var opt = {
        url: 'http://www.justdial.com/functions/reviews_initial.php?ct='+ct+'&cid='+docid+'&paid='+paid+'&tab=&city='+ct+'&abgraph=0&pg_no=1',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.155 Safari/537.36'
        }
      };

      request(opt, function(e, r, h){
          if(!e) {
            var j = JSON.parse(h),
                r = url.parse(j.overallrating, true).query.chd.replace('t:', '').split(',');

						var fields = ['name', 'total_rating', 'average_stars', 'poor_rating', 'average_rating', 'good_rating', 'very_good_rating', 'excellent_rating', 'phone', 'address', 'verified', 'website'];
			
          	var json = {
							name: $('.fn').text(),
							total_rating: j.totRatings.total,
							average_stars: j.totRatings.stars,
							poor_rating: ((j.totRatings.total/100)*r[4]).toFixed(1),
							average_rating: ((j.totRatings.total/100)*r[3]).toFixed(1),
							good_rating: ((j.totRatings.total/100)*r[2]).toFixed(1),
							very_good_rating: ((j.totRatings.total/100)*r[1]).toFixed(1),
							excellent_rating: ((j.totRatings.total/100)*r[0]).toFixed(1),
							phone: $('.telCntct a').eq(0).text(),
							address: $('#fulladdress').text().trim(),
							verified: $('.ico-jdvry').hasClass('ico-jdvry'),
							website: $('.comp-contact').children().last().find('a').text().trim()
            };
			
						out_arr.push(json);

            if (uri_arr.length > (++index)) {
							second(index++);
							
							io.emit('status', 'Fetching data of URL: '+index+'/'+uri_arr.length);
            } else {
							json2csv({ data: out_arr, fields: fields }, function(err, csv) {
								if (err) console.log(err);
								
								fs.writeFile('file.csv', csv, function(err) {
									if (err) throw err;

									uri_arr = [];
									out_arr = [];
									
									io.emit('file', 'file.csv saved to the path');
								});
							});
						}
          } else {
            console.log(e);
						io.emit('err', e);
          }
      });
    } else {
      console.log(error);
	  	io.emit('err', error);
    }
  });
}

console.log('Open localhost with port 8080');