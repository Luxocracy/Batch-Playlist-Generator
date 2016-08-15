// Define some variables used to remember state.
var playlistId;
var playlistItems = {};
var playlists = {};
var episodeNumbers = [];
var previousSearch = {
  channel: '',
  limit: false,
  array: []
};

// Listeners
var searchBox = {
  timer: null,
  show: function() {
    $('#oldSearch').show();
  },
  hide: function() {
    $('#oldSearch').hide();
  },
  enter: function() {
    clearTimeout(searchBox.timer);
    if($('#oldSearch ul li').length > 0) {
      searchBox.show();
    }
  },
  leave: function() {
    clearTimeout(searchBox.timer);
    if(!$('#keywords').is(':focus') && !$('#oldSearch').is(':hover')) {
      searchBox.timer = setTimeout(searchBox.hide, 500);
    }
  }
}

$('#keywords').off('focus').on('focus', searchBox.enter).off('blur').on('blur', searchBox.leave);
$('#oldSearch').hover(searchBox.enter, searchBox.leave);

// After the API loads, call a function to enable the playlist creation form.
function handleAPILoaded() {
  importPlaylists();
  enableForm();
}

// Enable the form for creating a playlist.
function enableForm() {
  $('.playlist-button').attr('disabled', false);
}

// Disable the form for creating a playlist.
function disableForm() {
  $('.playlist-button').attr('disabled', true);
}

// Reset the form
function resetForm() {
  // Clear global variables
  playlistId = undefined;
  playlistItems = {};
  playlists = {};
  episodeNumbers = [];
  previousSearch = {
    channel: '',
    limit: false,
    array: []
  };

  $(':input').val('');  // Clear inputs
  $('#playlist-title').text('No title yet.');
  $('#playlist-description').text('No description yet.');
  $('#playlist-items').empty();
  $('#playlist-container').find('#video-container').empty().hide().end().find('#status').show().text('No videos added yet.');
  $('#options > div').hide(); // Hide all sections
  $('.choose-playlist').show();  // Show first section
  importPlaylists();
}

// Check if current playlist can use the auto update function.
$('#playlist-items').off('change').on('change', validateAutoUpdate);
function validateAutoUpdate(reset) {
  var selectId = $('#playlist-items').val();
  var select = (localStorage[selectId]) ? JSON.parse(localStorage[selectId]):{ channel: '', array: [] };
  var keywords = select.array[0];
  var channelName = select.channel;
  var limit = select.limit;

  // If any variable is missing, disable the button. Otherwise enable it.
  if(!keywords || !channelName || limit === undefined) {
    $('#auto-update').attr('disabled', true);
  } else {
    $('#auto-update').attr('disabled', false);
  }
}

// Import a list of your playlists
function importPlaylists() {
  disableForm();

  var query = function(nextPageToken) {
    var details = {
      part: 'snippet',
      maxResults: 50,
      mine: true
    }

    if(nextPageToken) details['pageToken'] = nextPageToken;

    var request = gapi.client.youtube.playlists.list(details);
    request.execute(function(response) {
      for(var i=0; i < response.items.length; i++) {
        playlists[response.items[i].id] = response.items[i];
        $('#playlist-items').append('<option value="'+ response.items[i].id +'">'+ response.items[i].snippet.title +'</option>');
      }
      if(response.nextPageToken) {
        query(response.nextPageToken);
      } else {
        enableForm();
        validateAutoUpdate(false);
      }
    });
  }
  query();  // First init
}

// Create a playlist.
function createPlaylist() {
  if($('.choose-playlist').is(':visible')) {
    $('.choose-playlist').hide();
    $('.create-playlist').show();
    return;
  }
  var title = $('#playlist-name').val() || 'Untitled Playlist';
  var privacyStatus = ($('#playlist-private')[0].checked) ? 'private':'public';
  var request = gapi.client.youtube.playlists.insert({
    part: 'snippet,status',
    resource: {
      snippet: {
        title: title,
        description: 'Playlist generated using the YouTube API and the "Youtube Series Playlist Generator"(https://luxocracy.github.io/YouTube-Series-Playlist-Generator)'
      },
      status: {
        privacyStatus: privacyStatus
      }
    }
  });
  request.execute(function(response) {
    var result = response.result;
    if(result) {
      playlistId = result.id;
      playlistItems = {};

      $('.create-playlist').hide();
      $('.post-playlist').show();
      $('#playlist-id').val(playlistId);
      $('#playlist-link').attr('href', 'https://www.youtube.com/playlist?list='+playlistId);
      $('#playlist-title').html(result.snippet.title);
      $('#playlist-description').html(result.snippet.description);

      var searchList = "";
      for(var i=0; i < previousSearch.array.length; i++) {
        searchList += "<li>"+previousSearch.array[i]+"</li>";
      }

      $('#oldSearch ul').empty().append(searchList);
    } else {
      $('#status').html('Could not create playlist');
    }
  });
}

// Get/import playlist
function getPlaylist(callback) {
  disableForm();
  playlistId  = $('#playlist-items').val();
  var result  = playlists[playlistId];
  previousSearch = (localStorage[playlistId]) ? JSON.parse(localStorage[playlistId]):{ channel: '', array: [] };

  if(!previousSearch.array) previousSearch = { channel: '', limit: false, array: previousSearch };  // Incase the data is stored in the old format, aka, as an array instead of an object.

  $('#playlist-id').val(playlistId);
  $('#playlist-link').attr('href', 'https://www.youtube.com/playlist?list='+playlistId);
  $('#playlist-title').html(result.snippet.title);
  $('#playlist-description').html(result.snippet.description);

  var searchList = "";
  for(var i=0; i < previousSearch.array.length; i++) {
    searchList += "<li>"+previousSearch.array[i]+"</li>";
  }

  $('#oldSearch ul').empty().append(searchList);

  var query = function(nextPageToken) {
    var details = {
      part: 'snippet',
      playlistId: playlistId,
      maxResults: 50
    }

    if(nextPageToken) details['pageToken'] = nextPageToken;

    var request = gapi.client.youtube.playlistItems.list(details);

    request.execute(function(response) {
      for(var i=0; i < response.items.length; i++) {
        playlistItems[response.items[i].snippet.resourceId.videoId] = true;
        var videoSnippet = response.items[i].snippet;
        var videoId = videoSnippet.resourceId.videoId;
        if(!callback) appendVideo(videoId, videoSnippet);
      }
      if(response.nextPageToken) {
        query(response.nextPageToken);
      } else {
        if(!callback) {
          $('.choose-playlist').hide();
          $('.post-playlist').show();
        } else {
          callback();
        }
        enableForm();
      }
    });
  }
  query();  // First init
}

// Automatically update playlist
function autoUpdatePlaylist() {
  getPlaylist(function() {
    var keywords = previousSearch.array[0];
    var channelName = previousSearch.channel;
    var limit = previousSearch.limit;

    if(!keywords || !channelName || limit === undefined) {
      console.error('Could not update the playlist because of missing variables.');
      return;
    }

    $('#playlist-container #status').text('Searching for Videos to add...');

    searchForVideos(keywords, channelName, limit, true);
  });
}

// Get the actual ID of a channel instead of the channel name/url
function getChannelId(username, callback) {
  if(!username) callback(false);
  var details = {
    part: 'id',
    forUsername: username
  }
  var request = gapi.client.youtube.channels.list(details);
  request.execute(function(response) {
    callback(response.items[0].id);
  });
}

// Add a video ID specified in the form to the playlist.
function searchForVideos(keywords, channelName, limit, silent) {
  keywords = keywords || $('#keywords').val();
  channelName = channelName || $('#channel-id').val();
  limit = limit || $('#limitToTitle')[0].checked;

  if(keywords === "") {
    console.error('You need to enter a search term.');
    $('.search-query').append('<span style="color: red; font-size: 0.84em;"> You need to enter a search term.</span>');
    setTimeout(function() {
      $('.search-query span').remove();
    }, 2500);
    return;
  }
  getChannelId(channelName, function(channelId) {
    videoSearch(keywords, channelId, limit, silent);
  });
}

function videoSearch(searchValue, channelId, titleOnly, silent) {
  var result  = [];
  var match   = "";
  var exclude = "";
  var rawSearchValue = searchValue.slice(0);  //Copy the raw search string

  searchValue = searchValue.match(/([^\s"]+|"[^"]*")+/g);

	for(var i=0; i < searchValue.length; i++) {
		if(searchValue[i].match('^-')) {
			exclude += " "+searchValue[i];	//Add to Exclusions
		} else {
      match += " "+searchValue[i];  //Add to Matches
		}
	}

  var query = function(nextPageToken) {
    var details = {
      q: (titleOnly) ? 'allintitle:\''+ match +'\''+ exclude:match + exclude,
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: 50
    }

    if(channelId) details['channelId'] = channelId;
    if(nextPageToken) details['pageToken'] = nextPageToken;

    var request = gapi.client.youtube.search.list(details);
    request.execute(function(response) {
      // Store search, if videos were found.
      if(!nextPageToken && response.items.length > 0) {
        // Add search input to array. If it already exists, remove the old value beforehand. *This is to keep the latest successful search first.
        var oldValueIndex = previousSearch.array.indexOf(rawSearchValue);
        if(oldValueIndex >= 0) previousSearch.array.splice(oldValueIndex, 1);
        previousSearch.array.unshift(rawSearchValue);

        previousSearch = {
          channel: $('#channel-id').val() || '',
          limit: $('#limitToTitle')[0].checked,
          array: previousSearch.array.slice(0, 5)
        };

        if(!silent) localStorage[playlistId] = JSON.stringify(previousSearch);
      }
      for(var i=0; i < response.items.length; i++) {
        if(!response.items[i].id.videoId) console.log(response.items[i]);
        loopAddToPlaylist.add(response.items[i], silent);
      }
      if(response.nextPageToken) query(response.nextPageToken);
    });
  }
  query();  // First init
}

var loopAddToPlaylist = {
  queue: [],
  status: null,
  amount: 0,
  silent: false,
  add: function(item, silent) {
    this.silent = silent || false;
    this.queue.push(item);
    if(!this.status) {
      this.amount = 0;
      this.execute();
    }
  },
  execute: function() {
    this.status = 'working';
    var video = this.queue.shift();
    // console.log('Video ID:', video);
    addToPlaylist(video.id.videoId, video.snippet, this.silent, function(success) {
      if(success) this.amount++;
      if(this.queue.length > 0) {
        this.execute();
      } else {
        if(this.silent) $('#playlist-container #status').text('Successfully added '+ this.amount +' item(s) to the playlist.');
        console.log('Ran out of video IDs while adding them to the playlist.');
        this.status = null;
        getMissingEpisodes();
      }
    }.bind(this));
  }
}

// Add a video to a playlist. The "startPos" and "endPos" values let you
// start and stop the video at specific times when the video is played as
// part of the playlist. However, these values are not set in this example.
function addToPlaylist(videoId, videoSnippet, silent, callback) {
  // Check for duplicate
  if(playlistItems[videoId]) {
    if(typeof callback === 'function') callback(false);
    return;
  } else {
    playlistItems[videoId] = true;
  }

  var details = {
    videoId: videoId,
    kind: 'youtube#video'
  }
  var request = gapi.client.youtube.playlistItems.insert({
    part: 'snippet',
    resource: {
      snippet: {
        playlistId: playlistId,
        resourceId: details
      }
    }
  });
  request.execute(function(response) {
    if(!silent) {
      appendVideo(videoId, videoSnippet, callback);
    } else {
      callback(true);
    }
  });
}

function appendVideo(videoId, videoSnippet, callback) {
  var container     = $(document.querySelector('template').content).find('.yt-video').clone();
  var thumbnail     = videoSnippet.thumbnails.default;
  var meta          = timeSince(new Date(videoSnippet.publishedAt));
  var channelPrefix = (!callback) ? 'added to playlist by ':'by ';
  var videoUrl      = 'https://www.youtube.com/watch?v=' + videoId;
  var number        = videoSnippet.title.match(/[0-9]+/g);

  if(number) episodeNumbers.push(parseInt(number[number.length-1])); // Add episode number to global array

  $(container).find('.yt-thumbnail').append('<a href="'+ videoUrl +'"><img src="'+ thumbnail.url  +'" width="'+ thumbnail.width +'" height="'+ thumbnail.height +'"></a>').end()
  .find('.yt-title').append('<a href="'+ videoUrl +'">'+ videoSnippet.title +'</a>').end()
  .find('.yt-channel').append(channelPrefix + '<a href="https://www.youtube.com/user/'+ videoSnippet.channelTitle +'">'+ videoSnippet.channelTitle +'</a>').end()
  .find('.yt-meta').append('<span>'+ meta +'</span>').end()
  .find('.yt-description').append('<div>'+ videoSnippet.description +'</div>');

  if($('#playlist-container').find('#status')) $('#playlist-container').find('#status').hide().end().find('#video-container').show();
  $('#playlist-container').find('#video-container').prepend(container);
  if(typeof callback === 'function') callback();
}

function getMissingEpisodes() {
  var missing = [];
  var lastEpisode  = Math.max.apply(null, episodeNumbers);

  // Fill missing array
  for(var i=0; i < lastEpisode; i++) {
    missing[i] = i+1;
  }

  // Remove existing episodes
  for(var i=0; i < episodeNumbers.length; i++) {
    var pos = missing.indexOf(episodeNumbers[i]);
    if(pos !== -1) missing.splice(pos, 1);
  }

  $('#errors').empty();
  if(missing.length > 0) $('#errors').append('<span>Potentially missing episodes: '+ missing +'</span>');
}

function timeSince(date) {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = 0;

  interval = Math.floor(seconds / 31536000);
  if(interval > 1) {
    return interval + " years ago";
  }
  interval = Math.floor(seconds / 2592000);
  if(interval > 1) {
    return interval + " months ago";
  }
  interval = Math.floor(seconds / 86400);
  if(interval > 1) {
    return interval + " days ago";
  }
  interval = Math.floor(seconds / 3600);
  if(interval > 1) {
    return interval + " hours ago";
  }
  interval = Math.floor(seconds / 60);
  if(interval > 1) {
    return interval + " minutes ago";
  }
  return Math.floor(seconds) + " seconds ago";
}

function naturalCompare(a, b) {
	var ax = [], bx = [];

	a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { ax.push([$1 || Infinity, $2 || ""]) });
	b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { bx.push([$1 || Infinity, $2 || ""]) });

	while(ax.length && bx.length) {
			var an = ax.shift();
			var bn = bx.shift();
			var nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
			if(nn) return nn;
	}

	return ax.length - bx.length;
}
