var moreMenuStyle = {
  position: 'absolute',
  display: 'block',
  top: '26px',
  left: '-13px',
};
var MyFilesRowMoreMenu = React.createClass({
  onRevealClicked: function() {
    lbry.revealFile(this.props.path);
  },
  onRemoveClicked: function() {
    lbry.deleteFile(this.props.lbryUri, false);
  },
  onDeleteClicked: function() {
    var alertText = 'Are you sure you\'d like to delete "' + this.props.title + '?" This will ' +
      (this.completed ? ' stop the download and ' : '') +
      'permanently remove the file from your system.';

    if (confirm(alertText)) {
      lbry.deleteFile(this.props.lbryUri);
    }
  },
  render: function() {
    return (
      <div style={moreMenuStyle}>
        <Menu {...this.props}>
          <section className="card">
            <MenuItem onClick={this.onRevealClicked} label="Reveal file" /> {/* @TODO: Switch to OS specific wording */}
            <MenuItem onClick={this.onRemoveClicked} label="Remove from LBRY" />
            <MenuItem onClick={this.onDeleteClicked} label="Remove and delete file" />
          </section>
        </Menu>
      </div>
    );
  }
});

var moreButtonColumnStyle = {
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonContainerStyle = {
    display: 'block',
    position: 'relative',
  },
  moreButtonStyle = {
    fontSize: '1.3em',
  },
  progressBarStyle = {
    height: '15px',
    width: '230px',
    backgroundColor: '#444',
    border: '2px solid #eee',
    display: 'inline-block',
  }, 
  artStyle = {
    maxHeight: '100px',
    maxWidth: '100%',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  };
var MyFilesRow = React.createClass({
  onPauseResumeClicked: function() {
    if (this.props.stopped) {
      lbry.startFile(this.props.lbryUri);
    } else {
      lbry.stopFile(this.props.lbryUri);
    }
  },
  render: function() {
    //@TODO: Convert progress bar to reusable component

    var progressBarWidth = 230;

    if (this.props.completed) {
      var pauseLink = null;
      var curProgressBarStyle = {display: 'none'};
    } else {
      var pauseLink = <Link icon={this.props.stopped ? 'icon-play' : 'icon-pause'}
                            label={this.props.stopped ? 'Resume download' : 'Pause download'}
                            onClick={() => { this.onPauseResumeClicked() }} />;

      var curProgressBarStyle = Object.assign({}, progressBarStyle);
      curProgressBarStyle.width = Math.floor(this.props.ratioLoaded * progressBarWidth) + 'px';
      curProgressBarStyle.borderRightWidth = progressBarWidth - Math.ceil(this.props.ratioLoaded * progressBarWidth) + 2;
    }

    if (this.props.showWatchButton) {
      var watchButton = <WatchLink streamName={this.props.lbryUri} />
    } else {
      var watchButton = null;
    }

    return (
      <section className="card">
        <div className="row-fluid">
          <div className="span3">
            <img src={this.props.imgUrl || '/img/default-thumb.svg'} alt={'Photo for ' + this.props.title} style={artStyle} />
          </div>
          <div className="span8">
            <h3>{this.props.pending ? this.props.title : <a href={'/?show=' + this.props.lbryUri}>{this.props.title}</a>}</h3>
            {this.props.pending ? <em>This file is pending confirmation</em>
              : (
               <div>
                 <div className={this.props.completed ? 'hidden' : ''} style={curProgressBarStyle}></div>
                 { ' ' }
                 {this.props.completed ? 'Download complete' : (parseInt(this.props.ratioLoaded * 100) + '%')}
                 <div>{ pauseLink }</div>
                 <div>{ watchButton }</div>
                 {this.props.available ? null : <p><em>This file is uploading to Reflector. Reflector is a service that hosts a copy of the file on LBRY's servers so that it's available even if no one with the file is online.</em></p>}
               </div>
             )
            }
          </div>
          <div className="span1" style={moreButtonColumnStyle}>
            {this.props.pending ? null :
             <div style={moreButtonContainerStyle}>
               <Link style={moreButtonStyle} ref="moreButton" icon="icon-ellipsis-h" title="More Options" />
               <MyFilesRowMoreMenu toggleButton={this.refs.moreButton} title={this.props.title}
                                   lbryUri={this.props.lbryUri} fileName={this.props.fileName}
                                   path={this.props.path}/>
             </div>
            }
          </div>
        </div>
      </section>
    );
  }
});

var MyFilesPage = React.createClass({
  _fileTimeout: null,
  _fileInfoCheckNum: 0,
  _filesOwnership: {},
  _filesOwnershipLoaded: false,

  getInitialState: function() {
    return {
      filesInfo: null,
      filesAvailable: {},
    };
  },
  getDefaultProps: function() {
    return {
      show: null,
    };
  },
  componentDidMount: function() {
    document.title = "My Files";
  },
  componentWillMount: function() {
    this.getFilesOwnership();
    this.updateFilesInfo();
  },
  componentWillUnmount: function() {
    if (this._fileTimeout)
    {
      clearTimeout(this._fileTimeout);
    }
  },
  getFilesOwnership: function() {
    lbry.getFilesInfo((filesInfo) => {
      var ownershipLoadedCount = 0;
      for (let i = 0; i < filesInfo.length; i++) {
        let fileInfo = filesInfo[i];
        lbry.call('get_my_claim', {name: fileInfo.lbry_uri}, (claim) => {
          this._filesOwnership[fileInfo.lbry_uri] = false;
          ownershipLoadedCount++;
          if (ownershipLoadedCount >= filesInfo.length) {
            this._filesOwnershipLoaded = true;
          }
        }, (err) => {
          this._filesOwnership[fileInfo.lbry_uri] = true;
          ownershipLoadedCount++;
          if (ownershipLoadedCount >= filesInfo.length) {
            this._filesOwnershipLoaded = true;
          }
        });
      }
    });
  },
  updateFilesInfo: function() {
    lbry.getFilesInfo((filesInfo) => {
      if (!filesInfo) {
        filesInfo = [];
      }

      if (!(this._fileInfoCheckNum % 5)) {
        // Time to update file availability status

        for (let fileInfo of filesInfo) {
          let name = fileInfo.lbry_uri;

          lbry.search(name, (results) => {
            var result = results[0];

            if (result.name != name) {
              // File not listed in Lighthouse
              var available = false;
            } else {
              var available = result.available;
            }

            if (typeof this.state.filesAvailable[name] === 'undefined' || available != this.state.filesAvailable[name]) {
              var newFilesAvailable = Object.assign({}, this.state.filesAvailable);
              newFilesAvailable[name] = available;
              this.setState({
                filesAvailable: newFilesAvailable,
              });
            }
          });
        }
      }

      this._fileInfoCheckNum += 1;

      this.setState({
        filesInfo: filesInfo,
      });

      this._fileTimeout = setTimeout(() => { this.updateFilesInfo() }, 1000);
    });
  },
  render: function() {
    if (this.state.filesInfo === null || !this._filesOwnershipLoaded) {
      return (
        <main className="page">
          <BusyMessage message="Loading" />
        </main>
      );
    }

    if (!this.state.filesInfo.length) {
      var content = <span>You haven't downloaded anything from LBRY yet. Go <Link href="/" label="search for your first download" />!</span>;
    } else {
      var content = [],
          seenUris = {};

      for (let fileInfo of this.state.filesInfo) {
        let {completed, written_bytes, total_bytes, lbry_uri, file_name, download_path,
          stopped, metadata} = fileInfo;

        if (!metadata || seenUris[lbry_uri] || (this.props.show == 'downloaded' && this._filesOwnership[lbry_uri]) ||
            (this.props.show == 'published' && !this._filesOwnership[lbry_uri]))
        {
          continue;
        }

        seenUris[lbry_uri] = true;

        let {title, thumbnail} = metadata;

        if (!fileInfo.pending && typeof metadata == 'object') {
          var {title, thumbnail} = metadata;
          var pending = false;
        } else {
          var title = null;
          var thumbnail = null;
          var pending = true;
        }

        var ratioLoaded = written_bytes / total_bytes;

        var mediaType = lbry.getMediaType(metadata.content_type, file_name);
        var showWatchButton = (mediaType == 'video');

        content.push(<MyFilesRow key={lbry_uri} lbryUri={lbry_uri} title={title || ('lbry://' + lbry_uri)} completed={completed} stopped={stopped}
                                 ratioLoaded={ratioLoaded} imgUrl={thumbnail} path={download_path}
                                 showWatchButton={showWatchButton} pending={pending}
                                 available={this.state.filesAvailable[lbry_uri]} />);
      }
    }
    return (
      <main className="page">
        {content}
      </main>
    );
  }
});
