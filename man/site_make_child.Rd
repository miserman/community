% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/site_make_child.R
\name{site_make_child}
\alias{site_make_child}
\title{Make a Copy of a Data Site}
\usage{
site_make_child(parent, dir, update = FALSE, overwrite = FALSE,
  protect = "site.R", include = NULL, quiet = !interactive())
}
\arguments{
\item{parent}{Directory or GitHub repository name of the existing site to be copied.}

\item{dir}{Directory of the child site to put copies in.}

\item{update}{Logical; if \code{TRUE}, replaces existing site files if they are older than existing
files (from a local directory). Same as \code{overwrite} for remote sites. By default, only the
\code{datapackage.json} file is updated.}

\item{overwrite}{Logical; if \code{TRUE}, overwrites any existing site files. \code{datapackage.json}
is always overwritten.}

\item{protect}{A vector of file paths to prevent from being overwritten, relative to the site directory.}

\item{include}{A vector of paths to additional files to update from the parent site, relative to the
site's base directory.}

\item{quiet}{Logical; if \code{TRUE}, does not send messages.}
}
\value{
Invisible path to the child directory.
}
\description{
Copies baseline files from an existing data site. Useful for making different sites
based on the same data.
}
\examples{
\dontrun{
site_make_child("miserman/community_example", "../community_example")
}
}
